# HW-05 — Containerised HTTP service with Postgres

A minimal HTTP/1.1 server built directly on `node:net` — neither `node:http` nor
any framework is used; requests are parsed out of the raw byte stream and
responses are serialised to bytes by hand — packaged into a multi-stage image and
run alongside Postgres and an nginx TLS terminator with a single command.

## Quick start

```sh
./bootstrap.sh          # once per clone: generates the TLS cert and DB password
docker compose up -d
```

`bootstrap.sh` needs only `openssl`. It is idempotent — running it again leaves
existing credentials alone — and everything it writes is gitignored, so no
secret ever enters the repository. See [Credentials](#credentials).

```sh
curl -k https://localhost:8443/health   # 200, empty body
curl -k https://localhost:8443/users    # 200, JSON array from Postgres
curl -k https://localhost:8443/headers  # 200, the request headers as text
```

`-k` is required: the certificate is self-signed. Stop with `docker compose down`
(data survives) or `docker compose down -v` (data destroyed).

## Architecture

```
curl ──TLS──▶ nginx :443 ──plain HTTP──▶ node :3000 ──▶ postgres :5432
              holds the cert            no published    named volume
                                        port            data_sql
```

TLS terminates at nginx, which is the only service published to the host. The
Node process speaks plain HTTP on the internal Compose network and is
unreachable from outside Docker; it learns the original scheme and client IP from
the `X-Forwarded-*` headers nginx sets.

| Service | Image | Published | Purpose |
| --- | --- | --- | --- |
| `nginx` | `nginx:alpine` | `8443 → 443` | TLS termination, reverse proxy |
| `node` | `robotdreams-node:prod` | — | the application |
| `db` | built from `pg.Dockerfile` | `5432` | Postgres 18, seeded on first init |

## Image sizes

| Build | Size |
| --- | --- |
| Single-stage, `node:24` (naive) | **1.75 GB** |
| Multi-stage, `node:24-slim` (this repo) | **330 MB** |

The multi-stage build ships only the bundled `dist/index.js` on a slim base,
so the toolchain, `node_modules`, and TypeScript sources that the `builder` stage
needs never reach the final image.

Reproduce with:

```sh
docker compose -f compose.yaml build node
docker images robotdreams-node:prod
```

## Dockerfile notes

- **Multi-stage.** `builder` installs dev dependencies and runs `pnpm build`
  (typecheck + bundle); `runner` copies only `dist/`. There is no install step in
  the final stage at all — the bundler inlines runtime dependencies, so the image
  carries no `node_modules`.
- **Layer cache.** `COPY package.json pnpm-lock.yaml` and `pnpm install` come
  before `COPY . .`, so editing a file under `src/` reuses the cached install
  layer instead of resolving dependencies again.
- **Non-root.** The final stage switches to `USER node`; verify with
  `docker run --rm robotdreams-node:prod id -u` → `1000`.
- **Healthcheck.** In the Dockerfile, requesting `/health` on the app's own port.

## Development

```sh
docker compose watch
```

`compose.override.yaml` is merged automatically by `docker compose`. It builds
the `builder` stage instead of `runner`, bind-mounts the project at `/build`,
protects the image's `node_modules` with an anonymous volume, and runs
`node --watch src/index.ts` as the `node` user.

Hot reload goes through Compose's `develop.watch` rather than relying on
`node --watch` alone: on macOS and Windows, bind mounts deliver file *contents*
but not inotify *events*, so a watcher inside the container never learns that a
host file changed. Compose watches on the host, where events work, and restarts
the service. `docker compose watch` is therefore the command to use while
developing — plain `up` gives you the mount without the reload.

The base file stays usable on its own for CI:

```sh
docker compose -f compose.yaml config          # valid, no dev bind mounts
docker compose -f compose.yaml up -d --wait
```

### Scripts

| Command | Purpose |
| --- | --- |
| `pnpm stack:up` | build and start the production shape (no override) |
| `pnpm stack:up:override` | build and start with dev overrides |
| `pnpm stack:down` | stop, keeping volumes |
| `pnpm stack:reset` | stop and destroy volumes |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm build` | typecheck, then bundle with rolldown |
| `pnpm node:dev` | run from source on the host |
| `pnpm bootstrap` | generate the local certificate and DB password |

## Data persistence

Postgres data lives in the named volume `data_sql`, so it survives
`docker compose down`. Verified with:

```sh
docker compose exec -T db psql -U postgres -d sampledb \
  -c "INSERT INTO users (name, email) VALUES ('Persist Probe','persist@example.com') ON CONFLICT DO NOTHING;"

docker compose down            # note: no -v
docker compose up -d --wait

docker compose exec -T db psql -U postgres -d sampledb \
  -tAc "SELECT count(*) FROM users WHERE email='persist@example.com';"
# → 1
```

`docker compose down -v` removes the volume and the next start re-runs
`scripts/seed.sql`, since `/docker-entrypoint-initdb.d/` only executes when the
data directory is empty.

## Credentials

Nothing sensitive is committed. `certs/` and `secrets/` are gitignored and
produced locally by `./bootstrap.sh`:

| File | Contents |
| --- | --- |
| `certs/key.pem`, `certs/cert.pem` | self-signed certificate for `localhost`, 365 days |
| `secrets/pg_password.txt` | 24 random bytes from `openssl rand`, base64 |

They reach the containers as Compose secrets:

- Compose mounts each file as a secret at `/run/secrets/<name>`; no password is
  ever passed through an environment variable, so nothing leaks into image
  layers, `docker inspect`, or a serialised `process.env`.
- Postgres receives `POSTGRES_PASSWORD_FILE` (the `_FILE` convention its
  entrypoint implements) rather than `POSTGRES_PASSWORD`.
- The app receives `PG_PASSWORD_FILE` and reads the file at startup in
  `src/env.ts`, where a zod schema validates every environment variable and
  transforms the path into the password. A missing or empty file fails the boot
  with a message naming the variable, rather than surfacing later as a failed
  query.

A real deployment supplies real values through the same `secrets:` block —
nothing about the application changes. `.dockerignore` also excludes `certs/`
and `secrets/`, so the credentials cannot end up in an image layer even by
accident, which is the failure mode that makes leaked secrets permanent.

Regenerate at any time:

```sh
./bootstrap.sh --force
```

## Configuration

`.env` holds only non-sensitive values and is committed; `.env.example`
documents the same keys. Every reference in `compose.yaml` has a default, so the
stack starts even with no `.env` present.

| Variable | Default | Meaning |
| --- | --- | --- |
| `NODE_PORT` | `3000` | port the app listens on, inside its container |
| `HOST_PORT` | `8443` | host port mapped to nginx's `443` |
| `PG_USER` | `postgres` | Postgres role, used by both `db` and `node` |
| `PG_DB` | `sampledb` | database name, used by both `db` and `node` |

## Endpoints

| Request | Response |
| --- | --- |
| `GET /health` | `200`, empty body — used by the Docker healthcheck |
| `GET /users` | `200`, `application/json`, rows from the seeded `users` table |
| `GET /headers` | `200`, `text/plain`, the request headers one per line |
| anything else | `404` |

## Project structure

| Path | Purpose |
| --- | --- |
| `src/index.ts` | routes and entry point |
| `src/bootstrap.ts` | HTTP server and Postgres pool construction |
| `src/env.ts` | zod-validated environment, reads the DB password from disk |
| `src/server/` | `HttpServer`, `Router`, `Response` — raw HTTP/1.1 over TCP |
| `node.Dockerfile` | multi-stage app image |
| `pg.Dockerfile` | Postgres plus the seed script |
| `compose.yaml` | base stack, CI-safe |
| `compose.override.yaml` | dev overrides: bind mount, hot reload, non-root |
| `nginx/default.conf.template` | TLS termination and reverse proxy config |
| `scripts/seed.sql` | schema and sample rows, run on first DB init |
| `bootstrap.sh` | generates local dev credentials (run once after cloning) |
