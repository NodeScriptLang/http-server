import { Logger } from '@nodescript/logger';
import { createServer, IncomingMessage, Server, ServerResponse } from 'http';
import { config } from 'mesh-config';
import { dep, Mesh, ServiceKey } from 'mesh-ioc';
import { Socket } from 'net';

import { HttpContext } from './HttpContext.js';
import { HttpHandler } from './HttpHandler.js';

const HTTP_HANDLERS_KEY = 'httpHandlers';
const HTTP_SCOPE_KEY = 'httpRequestScope';

export class HttpServer {

    static SCOPE = HTTP_SCOPE_KEY;
    static HANDLERS = HTTP_HANDLERS_KEY;

    @dep() logger!: Logger;
    @dep({ key: HTTP_SCOPE_KEY }) createRequestScope!: () => Mesh;
    @dep({ key: HTTP_HANDLERS_KEY }) handlerKeys!: ServiceKey<HttpHandler>[];

    @config({ default: 8080 }) HTTP_PORT!: number;
    @config({ default: '127.0.0.1' }) HTTP_ADDRESS!: string;
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
            const context = new HttpContext(this, mesh, req, res);
            mesh.connect(context);
            await context.next()
                .catch(error => {
                    context.status = 500;
                    context.body = {
                        name: 'InternalServerError',
                        message: error.message,
                    };
                });
            context.sendResponse();
        } catch (error) {
            this.logger.error('HttpServer misconfigured', { error });
            res.writeHead(500, { 'content-type': 'application/json' });
            res.end(JSON.stringify({
                name: 'InternalServerError',
                message: 'The request cannot be processed'
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
