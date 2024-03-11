import { HttpContext } from './HttpContext.js';
import { HttpHandler, HttpNext } from './HttpHandler.js';

export abstract class HttpDelegate implements HttpHandler {

    abstract handler: HttpHandler;

    async handle(ctx: HttpContext, next: HttpNext) {
        await this.handler.handle(ctx, next);
    }
}
