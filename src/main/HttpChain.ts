import { HttpContext } from './HttpContext.js';
import { HttpHandler, HttpNext } from './HttpHandler.js';
import { composeHandlers } from './util.js';

export class HttpChain implements HttpHandler {

    composed: HttpHandler;

    constructor(handlers: HttpHandler[] = []) {
        this.composed = composeHandlers(handlers);
    }

    async handle(ctx: HttpContext, next: HttpNext) {
        return await this.composed.handle(ctx, next);
    }

}
