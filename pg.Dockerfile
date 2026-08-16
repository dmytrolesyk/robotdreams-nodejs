# syntax=docker/dockerfile:1
FROM postgres:18
COPY scripts/seed.sql /docker-entrypoint-initdb.d/
