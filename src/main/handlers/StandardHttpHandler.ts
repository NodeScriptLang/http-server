import { ServerError } from '@nodescript/errors';
import { HistogramMetric, metric } from '@nodescript/metrics';

import { HttpContext } from '../HttpContext.js';
import { HttpHandler, HttpNext } from '../HttpHandler.js';

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

    @metric()
    latency = new HistogramMetric('app_http_latency', 'HTTP request/response latency');

    async handle(ctx: HttpContext, next: HttpNext) {
        let error: any = undefined;
        try {
            await next();
        } catch (err: any) {
            error = err;
            const hasStatus = typeof error.status === 'number' && error.status >= 100 && error.status < 599;
            ctx.status = hasStatus ? error.status : 500;
            const presentedErr = hasStatus ? error : new ServerError();
            ctx.responseBody = {
                name: presentedErr.name,
                message: presentedErr.message,
            };
        } finally {
            const latency = Date.now() - ctx.startedAt;
            const logLevel = ctx.status >= 500 ? 'error' : 'info';
            ctx.logger[logLevel](error ? `Http Error` : `Http Request`, {
                method: ctx.method,
                url: ctx.path,
                status: ctx.status,
                actor: ctx.state.actor,
                latency,
                agent: ctx.requestHeaders['user-agent'],
                requestId: ctx.requestHeaders['x-request-id'],
                error,
            });
            this.latency.addMillis(latency, {
                method: ctx.method,
                url: ctx.path,
                status: ctx.status,
            });
            ctx.setResponseHeader('Server-Timing', `total;dur=${latency}`);
        }
    }

}
