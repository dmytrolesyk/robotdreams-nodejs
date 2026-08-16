import type { Socket } from 'node:net';
import {
  CONTENT_TYPES_MAP,
  STATUS_CODES_MAP,
  type StatusCode,
  type ContentTypeAlias,
} from './helpers.ts';

export class Response {
  private status: StatusCode | undefined;
  private socket: Socket;
  private headers = new Map<string, string>();
  constructor(socket: Socket) {
    this.socket = socket;
  }
  setStatus(status: StatusCode): this {
    this.status = status;
    return this;
  }
  setHeader(name: string, value: string): this {
    this.headers.set(name.toLowerCase(), value);
    return this;
  }
  setHeaders(headers: Record<string, string>): this {
    for (const [name, value] of Object.entries(headers)) {
      this.setHeader(name, value);
    }
    return this;
  }
  setContentType(alias: ContentTypeAlias): this {
    return this.setHeader('content-type', CONTENT_TYPES_MAP[alias]);
  }
  private serializeHead(contentLength: number) {
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
  send(body?: Buffer | string) {
    const payload = Buffer.isBuffer(body) ? body : Buffer.from(body ?? '', 'utf-8');
    this.socket.write(this.serializeHead(payload.byteLength), 'latin1');
    if (payload.byteLength > 0) {
      this.socket.write(payload);
    }
    this.socket.end();
  }
}
