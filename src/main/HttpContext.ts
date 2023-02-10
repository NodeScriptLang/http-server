import { InvalidStateError, RequestSizeExceededError } from '@nodescript/errors';
import { IncomingMessage, ServerResponse } from 'http';
import { Stream } from 'stream';

import { HttpDict } from './HttpDict.js';
import { HttpServer } from './HttpServer.js';
import { searchParamsToDict } from './util.js';

export type RequestBodyType = 'auto' | 'raw' | 'json' | 'text' | 'urlencoded';

export type HttpResponseBody = Stream | Buffer | string | object | undefined;

const EMPTY_STATUSES = new Set([204, 205, 304]);

export class HttpContext {

    protected startedAt = Date.now();
    protected index = -1;

    host: string;
    url: URL;
    query: HttpDict;
    requestHeaders: HttpDict;
    requestBody: any = undefined;

    status = 404;
    responseHeaders: HttpDict = {};
    responseBody: HttpResponseBody = undefined;

    constructor(
        readonly server: HttpServer,
        readonly request: IncomingMessage,
        readonly response: ServerResponse,
    ) {
        this.requestHeaders = (this.request as any).headersDistinct; // Added in 18.3.0, TS doesn't know yet
        this.host = this.requestHeaders['host'][0];
        this.url = new URL(this.request.url ?? '', `http://${this.host}`);
        this.query = searchParamsToDict(this.url.searchParams);
    }

    get method() {
        return (this.request.method ?? '').toUpperCase();
    }

    get body() {
        return this.requestBody;
    }

    set body(body) {
        this.responseBody = body;
    }

    async readRequestBody(type: RequestBodyType = 'auto') {
        if (this.request.complete) {
            return this.requestBody;
        }
        const raw = await this.readRequestBodyRaw();
        const actualType = type === 'auto' ? this.inferRequestBodyType() : type;
        switch (actualType) {
            case 'json': {
                this.requestBody = JSON.parse(raw.toString('utf-8'));
                break;
            }
            case 'text': {
                this.requestBody = raw.toString('utf-8');
                break;
            }
            case 'urlencoded': {
                const text = raw.toString('utf-8');
                const search = new URLSearchParams(text);
                this.requestBody = searchParamsToDict(search);
                break;
            }
            case 'raw':
            default:
                this.requestBody = raw;
        }
        return this.requestBody;
    }

    protected async readRequestBodyRaw(): Promise<Buffer> {
        let bytesRead = 0;
        const chunks: Buffer[] = [];
        for await (const chunk of this.request) {
            bytesRead += chunk.byteLength ?? chunk.length;
            if (bytesRead > this.server.HTTP_BODY_LIMIT) {
                throw new RequestSizeExceededError();
            }
            chunks.push(chunk);
        }
        return Buffer.concat(chunks);
    }

    inferRequestBodyType(): RequestBodyType {
        const contentType = this.requestHeaders['content-type']?.[0] ?? 'application/x-octet-stream';
        if (/application\/json/.test(contentType)) {
            return 'json';
        }
        if (/text\//.test(contentType)) {
            return 'text';
        }
        if (/application\/x-www-form-urlencoded/.test(contentType)) {
            return 'urlencoded';
        }
        return 'raw';
    }

    sendResponse(): void {
        const { response, responseBody } = this;
        if (response.headersSent) {
            throw new InvalidStateError('Headers already sent');
        }
        // Set all the headers assigned explicitly
        for (const [name, values] of Object.entries(this.responseHeaders)) {
            response.setHeader(name, values);
        }
        // Strip body from empty responses
        const isEmptyBody = EMPTY_STATUSES.has(this.status) ||
            this.request.method === 'HEAD' ||
            this.responseBody == null;
        if (isEmptyBody) {
            response.removeHeader('Content-Length');
            response.removeHeader('Content-Encoding');
            response.writeHead(this.status);
            response.end();
            return;
        }
        // Stream response body
        if (responseBody instanceof Stream) {
            response.writeHead(this.status);
            responseBody.pipe(response);
            return;
        }
        // Inferred body
        const [inferredContentType, buffer] = this.inferResponseBody();
        const contentType = response.getHeader('content-type') ?? inferredContentType;
        const contentLength = buffer.byteLength;
        response.setHeader('content-type', contentType);
        response.setHeader('content-length', contentLength);
        response.writeHead(this.status);
        response.end(buffer);
    }

    inferResponseBody(): [string, Buffer] {
        const body = this.responseBody;
        if (Buffer.isBuffer(body)) {
            return ['application/x-octet-stream', body];
        }
        if (typeof body === 'string') {
            return ['text/plain', Buffer.from(body, 'utf-8')];
        }
        return ['application/json', Buffer.from(JSON.stringify(body), 'utf-8')];
    }

}
