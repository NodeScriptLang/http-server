import { HttpContext } from './HttpContext.js';
import { HttpHandler, HttpNext } from './HttpHandler.js';

export abstract class HttpChain implements HttpHandler {

    abstract handlers: HttpHandler[];

    async handle(ctx: HttpContext, next: HttpNext) {
        const dispatch = async (index: number) => {
            if (index >= this.handlers.length) {
                return await next();
            }
            const handler = this.handlers[index];
            await handler.handle(ctx, () => dispatch(index + 1));
        };
        return await dispatch(0);
    }


}
