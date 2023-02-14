import { HttpContext } from './HttpContext.js';
import { HttpHandler, HttpHandlerFn, HttpNext } from './HttpHandler.js';
import { HttpRoute } from './HttpRoute.js';
import { compose, createRouteHandler } from './util.js';

export abstract class HttpRouter implements HttpHandler {

    abstract routes: HttpRoute[];

    protected composed: HttpHandlerFn | null = null;

    protected getComposedHandler() {
        if (!this.composed) {
            const fns = this.routes.map<HttpHandlerFn>(_ => createRouteHandler(_));
            this.composed = compose(fns);
        }
        return this.composed;
    }

    async handle(ctx: HttpContext, next: HttpNext): Promise<void> {
        return await this.getComposedHandler()(ctx, next);
    }

}
