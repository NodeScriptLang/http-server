import { Logger, StructuredLogHttpRequest } from '@nodescript/logger';
import { dep } from 'mesh-ioc';

import { HttpContext } from '../HttpContext.js';
import { HttpHandler, HttpNext } from '../HttpHandler.js';
import { HttpErrorHandler } from './HttpErrorHandler.js';

/**
 * A middleware for common functionality:
 *
 * - Standard error handling & presentation
 * - Request logging
 * - Request Id
 * - Latency metrics
 * - Server Timing
 *
 * Note: it should be bound to global scope because doesn't use request-scoped dependencies.
 */
export class StandardHttpHandler implements HttpHandler {

    @dep() private logger!: Logger;

    errorHandler = new HttpErrorHandler();

    async handle(ctx: HttpContext, next: HttpNext) {
        try {
            await this.errorHandler.handle(ctx, next);
        } finally {
            const latency = Date.now() - ctx.startedAt;
            const logLevel = ctx.status >= 500 ? 'error' : 'info';
            const httpRequest: StructuredLogHttpRequest = {
                requestMethod: ctx.method,
                requestUrl: ctx.path,
                status: ctx.status,
                latency: `${latency / 1000}s`,
                userAgent: ctx.getRequestHeader('user-agent', ''),
            };
            const error = ctx.state.error ?? undefined;
            this.logger[logLevel](error ? `Http Error` : `Http Request`, {
                httpRequest,
                actor: ctx.state.actor,
                requestId: ctx.requestHeaders['x-request-id'],
                error,
            });
            ctx.setResponseHeader('Server-Timing', `total;dur=${latency}`);
        }
    }

}
