import { getHeaderEnd, HEADER_DELIMITER, } from './helpers.js';
import { Response } from './response.js';
class Router {
    routes;
    constructor() {
        this.routes = new Map();
    }
    registerRoute({ method, path, handler, }) {
        let handlersByMethod = this.routes.get(path);
        if (!handlersByMethod) {
            handlersByMethod = new Map();
            this.routes.set(path, handlersByMethod);
        }
        if (handlersByMethod.has(method)) {
            throw new Error(`Route ${method} ${path} has already been registered`);
        }
        handlersByMethod.set(method, handler);
    }
    get(path, handler) {
        this.registerRoute({ method: 'GET', path, handler });
        return this;
    }
    post(path, handler) {
        this.registerRoute({ method: 'POST', path, handler });
        return this;
    }
    put(path, handler) {
        this.registerRoute({ method: 'PUT', path, handler });
        return this;
    }
    patch(path, handler) {
        this.registerRoute({ method: 'PATCH', path, handler });
        return this;
    }
    delete(path, handler) {
        this.registerRoute({ method: 'DELETE', path, handler });
        return this;
    }
    options(path, handler) {
        this.registerRoute({ method: 'OPTIONS', path, handler });
        return this;
    }
    head(path, handler) {
        this.registerRoute({ method: 'HEAD', path, handler });
        return this;
    }
    findHandler(path, method) {
        return this.routes.get(path)?.get(method);
    }
}
export class HttpServer {
    _port;
    server;
    router;
    constructor(createTransport, timeout = 5000) {
        this.server = createTransport(socket => {
            console.log('client connected');
            socket.setTimeout(timeout);
            socket.on('timeout', () => {
                console.log('socket timeout');
                socket.end();
            });
            socket.on('end', () => {
                console.log('client disconnected');
            });
            this.parseRequest(socket);
        });
        this.server.on('error', err => {
            throw err;
        });
        this.router = new Router();
    }
    get port() {
        return this._port;
    }
    parseRequestMetadata(buf) {
        const headerEnd = getHeaderEnd(buf);
        if (headerEnd === -1)
            return null;
        const [requestLine, ...headerLines] = buf.toString('latin1').slice(0, headerEnd).split('\r\n');
        const [method, rawPath, httpVersion] = requestLine.split(' ');
        const headers = headerLines.reduce((headers, headerLine) => {
            const [key, value] = headerLine.split(/:(.*)/s);
            return Object.assign(headers, { [key.toLowerCase().trim()]: value.trim() });
        }, {});
        const [path, query] = rawPath.split('?');
        return { method: method, path: path, httpVersion, headers, query };
    }
    parseRawBody(buf, contentLength) {
        const bodyStart = getHeaderEnd(buf) + HEADER_DELIMITER.length;
        const bodyEnd = bodyStart + contentLength;
        if (buf.byteLength < bodyEnd) {
            return null;
        }
        return buf.subarray(bodyStart, bodyEnd);
    }
    parseRequest(socket) {
        let buf = Buffer.alloc(0);
        let requestMetadata = null;
        let body = null;
        socket.on('data', chunk => {
            buf = Buffer.concat([buf, Buffer.from(chunk)]);
            if (!requestMetadata) {
                requestMetadata = this.parseRequestMetadata(buf);
            }
            if (requestMetadata) {
                if (requestMetadata.headers['content-length']) {
                    body = this.parseRawBody(buf, Number(requestMetadata.headers['content-length']));
                    if (body) {
                        const req = { ...requestMetadata, body };
                        this.handleRequest(req, socket);
                    }
                }
                else {
                    this.handleRequest(requestMetadata, socket);
                }
            }
        });
    }
    async handleRequest(req, socket) {
        const res = new Response(socket);
        const handler = this.router.findHandler(req.path, req.method);
        if (handler) {
            try {
                return await handler(req, res);
            }
            catch (e) {
                return res.setStatus(500).send('Something went wrong');
            }
        }
        return res.setStatus(404).send('Route not found');
    }
    get(path, handler) {
        this.router.get(path, handler);
        return this;
    }
    post(path, handler) {
        this.router.post(path, handler);
        return this;
    }
    put(path, handler) {
        this.router.put(path, handler);
        return this;
    }
    patch(path, handler) {
        this.router.patch(path, handler);
        return this;
    }
    delete(path, handler) {
        this.router.delete(path, handler);
        return this;
    }
    options(path, handler) {
        this.router.options(path, handler);
        return this;
    }
    head(path, handler) {
        this.router.head(path, handler);
        return this;
    }
    listen(port) {
        this._port = port;
        this.server.listen(port, () => {
            console.log('server listening');
        });
    }
}
