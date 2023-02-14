import { NotFoundError } from '@nodescript/errors';
import { Logger } from '@nodescript/logger';
import { createServer, IncomingMessage, Server, ServerResponse } from 'http';
import { config } from 'mesh-config';
import { dep, Mesh } from 'mesh-ioc';
import { Socket } from 'net';

import { HttpContext } from './HttpContext.js';
import { HttpHandler } from './HttpHandler.js';

const HTTP_HANDLER_KEY = 'HttpServer:handler';
const HTTP_SCOPE_KEY = 'HttpServer:scope';

export class HttpServer {

    static SCOPE = HTTP_SCOPE_KEY;
    static HANDLER = HTTP_HANDLER_KEY;

    @dep() logger!: Logger;
    @dep({ key: HTTP_SCOPE_KEY }) createRequestScope!: () => Mesh;

    @config({ default: 8080 }) HTTP_PORT!: number;
    @config({ default: '0.0.0.0' }) HTTP_ADDRESS!: string;
    @config({ default: 300000 }) HTTP_TIMEOUT!: number;
    @config({ default: 5000 }) HTTP_SHUTDOWN_DELAY!: number;
    @config({ default: 5 * 1024 * 1024 }) HTTP_BODY_LIMIT!: number;

    protected server: Server | null = null;
    protected requestsPerSocket = new Map<Socket, number>();
    protected stopping = false;

    async start() {
        if (this.server) {
            return;
        }
        this.stopping = false;
        this.requestsPerSocket.clear();
        const server = createServer((req, res) => this.handleRequest(req, res));
        this.server = server;
        server.on('connection', sock => this.onConnection(sock));
        server.on('request', (req, res) => this.onRequest(req, res));
        server.setTimeout(this.HTTP_TIMEOUT);
        await new Promise<void>((resolve, reject) => {
            server.on('error', err => reject(err));
            server.listen(this.HTTP_PORT, this.HTTP_ADDRESS, () => {
                this.logger.info(`Listening on ${this.HTTP_PORT}`);
                resolve();
            });
        });
    }

    async stop() {
        const server = this.server;
        if (!server) {
            return;
        }
        this.stopping = true;
        // This is required in environments like K8s where traffic is still being sent after SIGTERM
        await new Promise(r => setTimeout(r, this.HTTP_SHUTDOWN_DELAY));
        this.logger.info('Waiting for existing requests to finish');
        const closePromise = new Promise<void>((resolve, reject) => server.close(err => err ? reject(err) : resolve()));
        const timeout = setTimeout(() => this.destroyAllSockets());
        this.closeIdleSockets();
        await closePromise;
        clearTimeout(timeout);
        this.server = null;
    }

    getServer() {
        return this.server;
    }

    protected async handleRequest(req: IncomingMessage, res: ServerResponse) {
        try {
            const mesh = this.createRequestScope();
            const handler = mesh.resolve<HttpHandler>(HTTP_HANDLER_KEY);
            const ctx = new HttpContext(this, req, res);
            await handler.handle(ctx, () => {
                throw new NotFoundError(`${ctx.method} ${ctx.url.pathname}`);
            });
            ctx.sendResponse();
        } catch (error: any) {
            // Minimal error handling here, should be implemented by error handler
            const status = Number(error.status) || 500;
            this.logger.error('HttpServer: request failed', { error });
            res.writeHead(status, { 'content-type': 'application/json' });
            res.end(JSON.stringify({
                name: error.name,
                message: error.message,
            }));
        }
    }

    /**
     * Tracks the number of pending requests per socket, so that the server could close gracefully
     */
    protected onConnection(sock: Socket) {
        this.requestsPerSocket.set(sock, 0);
        sock.once('close', () => this.requestsPerSocket.delete(sock));
    }

    /**
     * Tracks requests per connection, close connection during shutdown, when requests are served.
     */
    protected onRequest(req: IncomingMessage, res: ServerResponse) {
        const { socket } = req;
        this.requestsPerSocket.set(socket, this.getSocketRequests(socket) + 1);
        res.once('finish', () => {
            const pending = this.getSocketRequests(socket) - 1;
            this.requestsPerSocket.set(socket, pending);
            if (this.stopping && pending === 0) {
                req.socket.end();
            }
        });
    }

    protected getSocketRequests(socket: Socket) {
        return this.requestsPerSocket.get(socket) ?? 0;
    }

    /**
     * Gracefully close idle sockets.
     */
    protected closeIdleSockets() {
        for (const [sock, count] of this.requestsPerSocket) {
            if (count === 0) {
                sock.end();
            }
        }
    }

    /**
     * Destroy all sockets non-gracefully.
     */
    protected destroyAllSockets() {
        for (const sock of this.requestsPerSocket.keys()) {
            sock.destroy();
        }
        this.requestsPerSocket.clear();
    }

}
