import net from 'node:net';
import { HttpServer } from './infra.js';
const PORT = 3000;
const server = new HttpServer(onConnection => net.createServer(onConnection));
server.get('/', async (req, res) => {
    res.send();
});
server.get('/headers', async (req, res) => {
    const { headers } = req;
    res.send(Object.entries(headers).reduce((str, [key, value]) => {
        return str + `${key}: ${value}` + '\r\n';
    }, ''));
});
server?.listen(PORT);
