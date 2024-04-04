import { ServerError } from '@nodescript/errors';
import { Logger, StructuredLogHttpRequest } from '@nodescript/logger';
import { dep } from 'mesh-ioc';

import { HttpContext } from '../HttpContext.js';
import { HttpHandler, HttpNext } from '../HttpHandler.js';

export class HttpErrorHandler implements HttpHandler {

    @dep() private logger!: Logger;

    async handle(ctx: HttpContext, next: HttpNext): Promise<void> {
        let error: any = null;
        try {
            await next();
        } catch (err: any) {
            error = err;
            const hasStatus = typeof error.status === 'number' &&
                error.status >= 100 && error.status < 599;
            ctx.status = hasStatus ? error.status : 500;
            const presentedErr = hasStatus ? error : new ServerError();
            ctx.responseBody = {
                name: presentedErr.name,
                message: presentedErr.message,
                details: presentedErr.details,
            };
        } finally {
            if (ctx.log) {
                this.log(ctx, error);
            }
        }
    }

    private log(ctx: HttpContext, error: any) {
        const isError = ctx.status >= 500;
        const logLevel = isError ? 'error' : 'info';
        const httpRequest: StructuredLogHttpRequest = {
            requestMethod: ctx.method,
            requestUrl: ctx.path,
            status: ctx.status,
            latency: `${(Date.now() - ctx.startedAt) / 1000}s`,
            userAgent: ctx.getRequestHeader('user-agent', ''),
        };
        this.logger[logLevel](isError ? `Http Error` : `Http Request`, {
            httpRequest,
            actor: ctx.state.actor,
            requestId: ctx.requestHeaders['x-request-id'],
            error,
        });
    }

}
