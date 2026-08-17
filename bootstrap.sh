#!/usr/bin/env sh
# Generates the local development credentials that compose.yaml mounts as
# secrets: a self-signed certificate for localhost and a random Postgres
# password. Both are gitignored and never leave this machine.
#
#   ./bootstrap.sh            generate anything that is missing
#   ./bootstrap.sh --force    replace what is already there
#
# Run once after cloning, then `docker compose up -d`.
set -eu

cd "$(dirname "$0")"

force=0
[ "${1:-}" = "--force" ] && force=1

if ! command -v openssl >/dev/null 2>&1; then
  echo "error: openssl not found in PATH" >&2
  exit 1
fi

mkdir -p certs secrets

if [ "$force" -eq 1 ] || [ ! -f secrets/pg_password.txt ]; then
  openssl rand -base64 24 | tr -d '\n' > secrets/pg_password.txt
  chmod 600 secrets/pg_password.txt
  echo "wrote secrets/pg_password.txt"
else
  echo "secrets/pg_password.txt exists, skipping (--force to replace)"
fi

if [ "$force" -eq 1 ] || [ ! -f certs/key.pem ] || [ ! -f certs/cert.pem ]; then
  openssl req -x509 -newkey rsa:2048 -nodes -days 365 \
    -keyout certs/key.pem -out certs/cert.pem \
    -subj "/CN=localhost" \
    -addext "subjectAltName=DNS:localhost,IP:127.0.0.1" 2>/dev/null
  chmod 600 certs/key.pem
  chmod 644 certs/cert.pem
  echo "wrote certs/key.pem and certs/cert.pem"
else
  echo "certs/key.pem and certs/cert.pem exist, skipping (--force to replace)"
fi

echo
echo "credentials ready — now run: docker compose up -d"
