import { HttpContext } from './HttpContext.js';
import { HttpHandler, HttpHandlerFn, HttpNext } from './HttpHandler.js';
import { compose } from './util.js';

export abstract class HttpChain implements HttpHandler {

    abstract handlers: HttpHandler[];

    protected composed: HttpHandlerFn | null = null;

    protected getComposedHandler() {
        if (!this.composed) {
            const fns = this.handlers.map<HttpHandlerFn>(_ => {
                return (ctx, next) => _.handle(ctx, next);
            });
            this.composed = compose(fns);
        }
        return this.composed;
    }

    async handle(ctx: HttpContext, next: HttpNext) {
        return await this.getComposedHandler()(ctx, next);
    }

}
