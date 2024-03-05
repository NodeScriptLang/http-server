import { config } from 'mesh-config';
import { dep, Mesh } from 'mesh-ioc';

import { HttpContext } from './HttpContext.js';
import { HttpHandler, HttpNext } from './HttpHandler.js';
import { HttpServer } from './HttpServer.js';

const HTTP_HANDLER_KEY = 'HttpServer:handler';
const HTTP_SCOPE_KEY = 'HttpServer:scope';

export class DefaultHttpServer extends HttpServer {

    static SCOPE = HTTP_SCOPE_KEY;
    static HANDLER = HTTP_HANDLER_KEY;

    @dep({ key: HTTP_SCOPE_KEY }) createRequestScope!: () => Mesh;

    @config({ default: 8080 }) HTTP_PORT!: number;
    @config({ default: '' }) HTTP_ADDRESS!: string;
    @config({ default: 120_000 }) HTTP_TIMEOUT!: number;
    @config({ default: 2000 }) HTTP_SHUTDOWN_DELAY!: number;
    @config({ default: 5 * 1024 * 1024 }) HTTP_BODY_LIMIT!: number;

    async handle(ctx: HttpContext, next: HttpNext): Promise<void> {
        const mesh = this.createRequestScope();
        mesh.connect(ctx);
        mesh.constant(HttpContext, ctx);
        const handler = mesh.resolve<HttpHandler>(HTTP_HANDLER_KEY);
        await handler.handle(ctx, next);
    }

}
