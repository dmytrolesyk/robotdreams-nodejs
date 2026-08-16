import { server, pool } from './bootstrap.ts';
import env from './env.ts';

const { PORT } = env;

server.get('/health', async (_req, res) => {
  res.send();
});

server.get('/headers', async (req, res) => {
  const { headers } = req;
  res.send(
    Object.entries(headers).reduce((str, [key, value]) => {
      return str + `${key}: ${value}` + '\r\n';
    }, ''),
  );
});

server.get('/users', async (_req, res) => {
  const { rows } = await pool.query('SELECT id, name, email FROM users ORDER BY id');
  res.setContentType('json').send(JSON.stringify(rows));
});

server.listen(PORT);
