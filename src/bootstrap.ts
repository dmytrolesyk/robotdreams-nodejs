import net from 'node:net';
import { HttpServer } from './server/server.ts';
import pg from 'pg';
import env from './env.ts';

const { PGHOST, PGPORT, PGUSER, PGDATABASE, PGPASSWORD } = env;

const pool = new pg.Pool({
  host: PGHOST,
  port: PGPORT,
  user: PGUSER,
  database: PGDATABASE,
  password: PGPASSWORD,
});

const server = new HttpServer(onConnection => net.createServer(onConnection));

export { server, pool };
