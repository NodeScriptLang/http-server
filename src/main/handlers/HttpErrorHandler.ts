import { ServerError } from '@nodescript/errors';

import { HttpContext } from '../HttpContext.js';
import { HttpHandler, HttpNext } from '../HttpHandler.js';

export class HttpErrorHandler implements HttpHandler {

    async handle(ctx: HttpContext, next: HttpNext): Promise<void> {
        try {
            await next();
        } catch (error: any) {
            const hasStatus = typeof error.status === 'number' &&
                error.status >= 100 && error.status < 599;
            ctx.status = hasStatus ? error.status : 500;
            const presentedErr = hasStatus ? error : new ServerError();
            ctx.responseBody = {
                name: presentedErr.name,
                message: presentedErr.message,
                details: presentedErr.details,
            };
            ctx.state.error = error;
        }
    }

}
