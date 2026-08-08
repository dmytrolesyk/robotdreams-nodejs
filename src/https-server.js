import tls from 'node:tls';
import fs from 'node:fs';
import { HttpServer } from './infra.js';
import path from 'node:path';
const PORT = 3443;
const readCertFile = (file) => fs.readFileSync(path.join(import.meta.dirname, file));
const options = {
    key: readCertFile('key.pem'),
    cert: readCertFile('cert.pem'),
};
const server = new HttpServer(onConnection => tls.createServer(options, onConnection));
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
