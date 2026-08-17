export const STATUS_CODES_MAP = {
  200: 'OK',
  201: 'Created',
  202: 'Accepted',
  204: 'No Content',

  301: 'Moved Permanently',
  302: 'Found',
  303: 'See Other',
  304: 'Not Modified',
  307: 'Temporary Redirect',
  308: 'Permanent Redirect',

  400: 'Bad Request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not Found',
  405: 'Method Not Allowed',
  406: 'Not Acceptable',
  408: 'Request Timeout',
  409: 'Conflict',
  411: 'Length Required',
  413: 'Content Too Large',
  414: 'URI Too Long',
  415: 'Unsupported Media Type',
  422: 'Unprocessable Content',
  429: 'Too Many Requests',
  431: 'Request Header Fields Too Large',

  500: 'Internal Server Error',
  501: 'Not Implemented',
  502: 'Bad Gateway',
  503: 'Service Unavailable',
  504: 'Gateway Timeout',
  505: 'HTTP Version Not Supported',
} as const;

export type StatusCode = keyof typeof STATUS_CODES_MAP;

export const CONTENT_TYPES_MAP = {
  txt: 'text/plain; charset=utf-8',
  html: 'text/html; charset=utf-8',
  css: 'text/css; charset=utf-8',
  js: 'text/javascript; charset=utf-8',
  json: 'application/json; charset=utf-8',
  xml: 'application/xml; charset=utf-8',
  csv: 'text/csv; charset=utf-8',
  md: 'text/markdown; charset=utf-8',

  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  svg: 'image/svg+xml',
  webp: 'image/webp',
  avif: 'image/avif',
  ico: 'image/x-icon',

  woff: 'font/woff',
  woff2: 'font/woff2',
  ttf: 'font/ttf',
  otf: 'font/otf',

  mp3: 'audio/mpeg',
  mp4: 'video/mp4',
  webm: 'video/webm',

  pdf: 'application/pdf',
  zip: 'application/zip',
  wasm: 'application/wasm',
  bin: 'application/octet-stream',
} as const;

export type ContentTypeAlias = keyof typeof CONTENT_TYPES_MAP;

export type ContentType = (typeof CONTENT_TYPES_MAP)[ContentTypeAlias];

export const HttpMethods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'] as const;

export type HttpMethod = (typeof HttpMethods)[number];

export type Path = `/${string}`;

export type RequestMetadata = {
  method: HttpMethod;
  httpVersion: string;
  path: Path;
  headers: Record<string, string>;
  query?: string;
};

export type Request = RequestMetadata & {
  body?: Buffer;
};

export const HEADER_DELIMITER = '\r\n\r\n';

export const getHeaderEnd = (buf: Buffer) => buf.indexOf(HEADER_DELIMITER);
