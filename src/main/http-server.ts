import koaCors from '@koa/cors';
import { Config, config } from '@nodescript/config';
import { ServerError } from '@nodescript/errors';
import { Logger } from '@nodescript/logger';
import { dep, Mesh, ServiceConstructor } from '@nodescript/mesh';
import { HistogramMetric, metric } from '@nodescript/metrics';
import http from 'http';
import Koa, { Context, Middleware, Next } from 'koa';
import koaBody from 'koa-body';
import stoppable, { StoppableServer } from 'stoppable';

export interface RequestHandler {
    handle(ctx: Context, next: Next): Promise<any>;
}

export type RequestHandlerClass = ServiceConstructor<RequestHandler>;

export class HttpServer {

    @config({ default: 8080 }) PORT!: number;
    @config({ default: '5mb' }) HTTP_JSON_LIMIT!: string;
    @config({ default: '10mb' }) HTTP_TEXT_LIMIT!: string;
    @config({ default: '1mb' }) HTTP_FORM_LIMIT!: string;
    @config({ default: 50 * 1024 * 1024 }) HTTP_MAX_FILE_SIZE_BYTES!: number;
    @config({ default: 10000 }) HTTP_SHUTDOWN_DELAY!: number;
    @config({ default: 300000 }) HTTP_TIMEOUT!: number;

    @dep() config!: Config;
    @dep() logger!: Logger;
    @dep({ key: 'httpRequestScope' }) createRequestScope!: () => Mesh;

    @metric()
    latency = new HistogramMetric('app_http_latency', 'HTTP request/response latency');

    server: StoppableServer | null = null;
    koa = new Koa();

    constructor() {
        this.koa.proxy = true;
        this.setupMiddleware();
    }

    async start() {
        if (this.server) {
            return;
        }
        const port = this.PORT;
        const server = stoppable(http.createServer(this.koa.callback()), this.HTTP_TIMEOUT);
        this.server = server;
        this.server.setTimeout(this.HTTP_TIMEOUT);
        server.listen(port, () => {
            this.logger.info(`Listening on ${port}`);
        });
    }

    async stop() {
        const server = this.server;
        if (!server) {
            return;
        }
        if (process.env.NODE_ENV === 'production') {
            this.logger.info(`Graceful shutdown: wait for traffic to stop being sent`);
            await new Promise(r => setTimeout(r, this.HTTP_SHUTDOWN_DELAY));
        }
        this.logger.info('Graceful shutdown: stop accepting new requests, wait for existing requests to finish');
        await new Promise(r => server.stop(r));
    }

    addRequestHandler(handlerClass: RequestHandlerClass) {
        this.koa.use((ctx, next) => {
            const mesh: Mesh = ctx.state.mesh;
            return mesh.resolve(handlerClass).handle(ctx, next);
        });
    }

    protected setupMiddleware() {
        this.koa.use(this.standardMiddleware());
        this.koa.use(koaCors({
            exposeHeaders: ['Date', 'Content-Length'],
            maxAge: 3600,
            credentials: true,
        }));
        this.koa.use(koaBody({
            json: true,
            urlencoded: true,
            multipart: true,
            text: true,
            jsonLimit: this.HTTP_JSON_LIMIT,
            textLimit: this.HTTP_TEXT_LIMIT,
            formLimit: this.HTTP_FORM_LIMIT,
            formidable: {
                maxFileSize: this.HTTP_MAX_FILE_SIZE_BYTES,
            },
        }));
    }

    protected standardMiddleware(): Middleware {
        return async (ctx: Context, next: Next) => {
            const startedAt = Date.now();
            ctx.state.startedAt = startedAt;
            const mesh = this.createRequestScope();
            mesh.constant('ctx', ctx);
            ctx.state.mesh = mesh;
            const requestId = ctx.header['x-request-id'];
            const agent = ctx.header['user-agent'];
            try {
                await next();
                const latency = Date.now() - startedAt;
                this.logger.info(`HTTP request`, {
                    method: ctx.method,
                    url: ctx.url,
                    status: ctx.status,
                    actor: ctx.state.actor,
                    latency,
                    agent,
                    requestId,
                });
                this.latency.addMillis(latency, {
                    method: ctx.method,
                    url: ctx.path,
                    status: ctx.staus,
                });
            } catch (error: any) {
                const status = Number(error.status) || 500;
                const isClientError = status >= 400 && status < 500;
                const logLevel = isClientError ? 'info' : 'error';
                ctx.status = isClientError ? error.status : 500;
                const latency = Date.now() - startedAt;
                this.logger[logLevel](`HTTP error`, {
                    method: ctx.method,
                    url: ctx.url,
                    status: ctx.status,
                    actor: ctx.state.actor,
                    latency,
                    agent,
                    requestId,
                    error,
                });
                this.latency.addMillis(latency, {
                    method: ctx.method,
                    url: ctx.path,
                    status: ctx.staus,
                });
                const presentedErr = isClientError ? error : new ServerError();
                ctx.body = {
                    name: presentedErr.name,
                    message: presentedErr.message,
                };
            } finally {
                ctx.header['server-timing'] = `total;dur=${Date.now() - startedAt}`;
            }
        };
    }

}
