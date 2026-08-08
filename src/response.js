import { CONTENT_TYPES_MAP, STATUS_CODES_MAP, } from './helpers.js';
export class Response {
    status;
    socket;
    headers = new Map();
    constructor(socket) {
        this.socket = socket;
    }
    setStatus(status) {
        this.status = status;
        return this;
    }
    setHeader(name, value) {
        this.headers.set(name.toLowerCase(), value);
        return this;
    }
    setHeaders(headers) {
        for (const [name, value] of Object.entries(headers)) {
            this.setHeader(name, value);
        }
        return this;
    }
    setContentType(alias) {
        return this.setHeader('content-type', CONTENT_TYPES_MAP[alias]);
    }
    serializeHead(contentLength) {
        const status = this.status ?? 200;
        const headers = new Map(this.headers);
        if (!headers.has('content-type')) {
            headers.set('content-type', CONTENT_TYPES_MAP.txt);
        }
        headers.set('content-length', String(contentLength));
        headers.set('connection', 'close');
        let head = `HTTP/1.1 ${status} ${STATUS_CODES_MAP[status]}\r\n`;
        for (const [name, value] of headers) {
            head += `${name}: ${value}\r\n`;
        }
        return head + '\r\n';
    }
    send(body) {
        const payload = Buffer.isBuffer(body) ? body : Buffer.from(body ?? '', 'utf-8');
        this.socket.write(this.serializeHead(payload.byteLength), 'latin1');
        if (payload.byteLength > 0) {
            this.socket.write(payload);
        }
        this.socket.end();
    }
}
