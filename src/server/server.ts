import type { Socket, Server } from 'node:net';
import {
  getHeaderEnd,
  HEADER_DELIMITER,
  type HttpMethod,
  type Path,
  type RequestMetadata,
  type Request,
} from './helpers.ts';
import { Response } from './response.ts';

type Handler = (req: Request, res: Response) => Promise<void>;

class Router {
  private routes: Map<Path, Map<HttpMethod, Handler>>;
  constructor() {
    this.routes = new Map();
  }
  private registerRoute({
    method,
    path,
    handler,
  }: {
    method: HttpMethod;
    path: Path;
    handler: Handler;
  }) {
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
  get(path: Path, handler: Handler): this {
    this.registerRoute({ method: 'GET', path, handler });
    return this;
  }
  post(path: Path, handler: Handler): this {
    this.registerRoute({ method: 'POST', path, handler });
    return this;
  }
  put(path: Path, handler: Handler): this {
    this.registerRoute({ method: 'PUT', path, handler });
    return this;
  }
  patch(path: Path, handler: Handler): this {
    this.registerRoute({ method: 'PATCH', path, handler });
    return this;
  }
  delete(path: Path, handler: Handler): this {
    this.registerRoute({ method: 'DELETE', path, handler });
    return this;
  }
  options(path: Path, handler: Handler): this {
    this.registerRoute({ method: 'OPTIONS', path, handler });
    return this;
  }
  head(path: Path, handler: Handler): this {
    this.registerRoute({ method: 'HEAD', path, handler });
    return this;
  }
  findHandler(path: Path, method: HttpMethod): Handler | undefined {
    return this.routes.get(path)?.get(method);
  }
}

type TransportCreator = (onConnection: (socket: Socket) => void) => Server;

export class HttpServer {
  private _port: number | undefined;
  private server: Server;
  private router: Router;
  private sockets: Set<Socket> = new Set();
  constructor(createTransport: TransportCreator, timeout = 3000) {
    this.server = createTransport(socket => {
      console.log('client connected');
      this.sockets.add(socket);
      socket.setTimeout(timeout);
      socket.on('timeout', () => {
        console.log('socket timeout');
        socket.end();
      });
      socket.on('close', () => {
        console.log('client disconnected');
        this.sockets.delete(socket);
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
  close(onClose: () => void, gracePeriod = 5000) {
    this.server.on('close', onClose);
    this.server.close();
    const forceCloseConnections = setTimeout(() => {
      this.sockets.forEach(socket => {
        socket.destroy();
        this.sockets.delete(socket);
      });
    }, gracePeriod);
    forceCloseConnections.unref();
  }

  private parseRequestMetadata(buf: Buffer): RequestMetadata | null {
    const headerEnd = getHeaderEnd(buf);
    if (headerEnd === -1) return null;
    const [requestLine, ...headerLines] = buf.toString('latin1').slice(0, headerEnd).split('\r\n');
    const [method, rawPath, httpVersion] = requestLine.split(' ');
    const headers = headerLines.reduce((headers, headerLine) => {
      const [key, value] = headerLine.split(/:(.*)/s);
      return Object.assign(headers, { [key.toLowerCase().trim()]: value.trim() });
    }, {});
    const [path, query] = rawPath.split('?');
    return { method: method as HttpMethod, path: path as Path, httpVersion, headers, query };
  }

  private parseRawBody(buf: Buffer, contentLength: number): Buffer | null {
    const bodyStart = getHeaderEnd(buf) + HEADER_DELIMITER.length;
    const bodyEnd = bodyStart + contentLength;
    if (buf.byteLength < bodyEnd) {
      return null;
    }
    return buf.subarray(bodyStart, bodyEnd);
  }

  private parseRequest(socket: Socket) {
    let buf = Buffer.alloc(0);
    let requestMetadata: RequestMetadata | null = null;
    let body: Buffer | null = null;

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
        } else {
          this.handleRequest(requestMetadata, socket);
        }
      }
    });
  }

  private async handleRequest(req: Request, socket: Socket) {
    const res = new Response(socket);
    const handler = this.router.findHandler(req.path, req.method);
    if (handler) {
      try {
        return await handler(req, res);
      } catch (e) {
        return res.setStatus(500).send('Something went wrong');
      }
    }
    return res.setStatus(404).send('Route not found');
  }

  get(path: Path, handler: Handler): this {
    this.router.get(path, handler);
    return this;
  }

  post(path: Path, handler: Handler): this {
    this.router.post(path, handler);
    return this;
  }

  put(path: Path, handler: Handler): this {
    this.router.put(path, handler);
    return this;
  }

  patch(path: Path, handler: Handler): this {
    this.router.patch(path, handler);
    return this;
  }

  delete(path: Path, handler: Handler): this {
    this.router.delete(path, handler);
    return this;
  }

  options(path: Path, handler: Handler): this {
    this.router.options(path, handler);
    return this;
  }

  head(path: Path, handler: Handler): this {
    this.router.head(path, handler);
    return this;
  }

  listen(port: number) {
    this._port = port;
    this.server.listen(port, () => {
      console.log('server listening');
    });
  }
}
