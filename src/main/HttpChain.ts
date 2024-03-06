import { HttpContext } from './HttpContext.js';
import { HttpHandler, HttpNext } from './HttpHandler.js';
import { composeHandlers } from './util.js';

export abstract class HttpChain implements HttpHandler {

    abstract handlers: HttpHandler[];

    protected composed: HttpHandler | null = null;

    protected getComposedHandler() {
        if (!this.composed) {
            this.composed = composeHandlers(this.handlers);
        }
        return this.composed;
    }

    async handle(ctx: HttpContext, next: HttpNext) {
        return await this.getComposedHandler().handle(ctx, next);
    }

}
