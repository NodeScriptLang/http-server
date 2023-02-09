import { Logger } from '@nodescript/logger';
import { createServer, IncomingMessage, Server, ServerResponse } from 'http';
import { config } from 'mesh-config';
import { dep, Mesh } from 'mesh-ioc';
import { Socket } from 'net';

import { HttpContext } from './HttpContext.js';
import { HttpHandlerClass } from './HttpHandler.js';

export class HttpServer {

    @dep() logger!: Logger;
    @dep({ key: 'httpRequestScope' }) createRequestScope!: () => Mesh;

    @config({ default: 8080 }) HTTP_PORT!: number;
    @config({ default: '127.0.0.1' }) HTTP_ADDRESS!: string;
    @config({ default: 300000 }) HTTP_TIMEOUT!: number;
    @config({ default: 5000 }) HTTP_SHUTDOWN_DELAY!: number;

    protected server: Server | null = null;
    protected requestsPerSocket = new Map<Socket, number>();
    protected stopping = false;

    handlers: HttpHandlerClass[] = [];

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

    async addHandler(handlerClass: HttpHandlerClass) {
        this.handlers.push(handlerClass);
    }

    protected async handleRequest(req: IncomingMessage, res: ServerResponse) {
        try {
            const mesh = this.createRequestScope();
            const context = new HttpContext(this, mesh, req, res);
            mesh.connect(context);
            await context.next();
            await this.sendResponse(context);
        } catch (error) {
            console.error('error', error);
            // TODO handle standard errors
        }
    }

    protected onConnection(sock: Socket) {
        // Track the number of pending requests per socket, so that we could close gracefully
        this.requestsPerSocket.set(sock, 0);
        sock.once('close', () => this.requestsPerSocket.delete(sock));
    }

    protected onRequest(req: IncomingMessage, res: ServerResponse) {
        // Track requests per connection, close connection during shutdown, when requests are served
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

    protected sendResponse(ctx: HttpContext) {
        const { res } = ctx;
        // TODO infer body content type
        // TODO apply headers
        // TODO stream body
        res.writeHead(ctx.status, ctx.responseHeaders);
        res.end(ctx.responseBody);
    }

}
