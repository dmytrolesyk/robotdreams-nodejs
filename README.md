# HW-03 — Raw HTTP and HTTPS servers on TCP/TLS

A minimal HTTP/1.1 server built directly on `node:net`, with an HTTPS variant on
`node:tls`. Neither `node:http` nor `node:https` is used anywhere — requests are
parsed out of the raw byte stream and responses are serialized to bytes by hand.

Both entry points share the same request parser, router and response builder;
only the transport differs.

## Requirements

- Node.js 20.11+ (uses `import.meta.dirname` and native ESM)

## Quick start

### 1. Generate a self-signed certificate

Required for the HTTPS server only. Run from the repository root:

```sh
openssl req -x509 -newkey rsa:2048 -nodes \
  -keyout src/key.pem -out src/cert.pem -days 365 \
  -subj "/CN=localhost" \
  -addext "subjectAltName=DNS:localhost,IP:127.0.0.1"
```

`key.pem` and `cert.pem` are listed in `.gitignore` and are not committed.

Flag notes:

- `-x509` produces a finished self-signed certificate instead of a signing request
- `-nodes` leaves the private key unencrypted, so the server can read it without a passphrase
- `-addext "subjectAltName=..."` is required by modern TLS clients, which ignore `CN`

### 2. Run the servers

```sh
node src/server.js        # http://localhost:3000
node src/https-server.js  # https://localhost:3443
```

## Endpoints

| Request | Response |
| --- | --- |
| `GET /` | `200 OK`, `Content-Type: text/plain` |
| `GET /headers` | `200 OK`, parsed request headers as `name: value` lines (names lower-cased) |
| anything else | `404 Not Found` |

Every response is a well-formed HTTP/1.1 message: status line, `Content-Type`,
`Content-Length`, `Connection`, a blank line, then the body.

### Examples

```sh
curl -sv http://localhost:3000/
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/nope
curl -s http://localhost:3000/headers -H "X-Demo: abc"

# HTTPS — -k is required, the certificate is self-signed
curl -sk -o /dev/null -w "%{http_code}\n" https://localhost:3443/
curl -sk https://localhost:3443/headers -H "X-Demo: abc"
```

## Project structure

| File | Purpose |
| --- | --- |
| `src/server.js` | HTTP entry point — creates the TCP transport via `net.createServer` |
| `src/https-server.js` | HTTPS entry point — creates the TLS transport via `tls.createServer` |
| `src/infra.js` | `HttpServer` and `Router` — connection handling, request parsing, routing |
| `src/response.js` | `Response` — status, headers and body serialization to raw bytes |
| `src/helpers.js` | status codes, content types, HTTP methods, shared types |

The `.ts` sources next to each `.js` file are the originals; the `.js` files are
what Node runs.

## TLS debug session

```sh
openssl s_client -connect localhost:3443 -servername localhost
```

```
Connecting to ::1
CONNECTED(00000005)
depth=0 CN=localhost
verify error:num=18:self-signed certificate
verify return:1
depth=0 CN=localhost
verify return:1
---
Certificate chain
 0 s:CN=localhost
   i:CN=localhost
   a:PKEY: RSA, 2048 (bit); sigalg: sha256WithRSAEncryption
   v:NotBefore: Aug  8 18:18:51 2026 GMT; NotAfter: Aug  8 18:18:51 2027 GMT
---
Server certificate
-----BEGIN CERTIFICATE-----
MIIDJTCCAg2gAwIBAgIUHt0buJi0YMIWqUzAeuKebZIdy6kwDQYJKoZIhvcNAQEL
... (truncated) ...
hyuuDu7n3o34BL/lHGz40khWMtSmaiXd7cOj7Nuk910BxRsUp0tXMpY=
-----END CERTIFICATE-----
subject=CN=localhost
issuer=CN=localhost
---
No client certificate CA names sent
Peer signing digest: SHA256
Peer signature type: rsa_pss_rsae_sha256
Negotiated TLS1.3 group: X25519MLKEM768
---
SSL handshake has read 2453 bytes and written 1620 bytes
Verification error: self-signed certificate
---
New, TLSv1.3, Cipher is TLS_AES_256_GCM_SHA384
Protocol: TLSv1.3
Server public key is 2048 bit
This TLS version forbids renegotiation.
Compression: NONE
Expansion: NONE
No ALPN negotiated
Early data was not sent
Verify return code: 18 (self-signed certificate)
---
```

### What `verify error:num=18` means

Code **18** (`DEPTH_ZERO_SELF_SIGNED_CERT`) means the certificate at depth 0 is
signed by its own private key rather than by a certificate authority in the
client's trust store, so there is no chain to walk and the server's identity
cannot be verified — which is exactly what is expected for a self-signed
development certificate, and it affects authentication only: the session itself
is still fully encrypted with `TLS_AES_256_GCM_SHA384` over TLS 1.3.

The output shows this directly in the certificate chain, where subject and
issuer are the same entity:

```
 0 s:CN=localhost
   i:CN=localhost
```

For comparison, the related verification codes:

| Code | Meaning |
| --- | --- |
| 18 | Self-signed certificate — the leaf signed itself, no chain at all |
| 19 | Self-signed certificate in the chain — a chain exists but its root is not trusted (typically a missing intermediate) |
| 10 | Certificate has expired — the chain is valid but `notAfter` has passed |
