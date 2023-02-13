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
            ctx.status = Number(error.status) || 500;
            const isServerError = ctx.status >= 500;
            const presentedErr = isServerError ? new ServerError() : error;
            ctx.responseBody = {
                name: presentedErr.name,
                message: presentedErr.message,
            };
        } finally {
            const latency = Date.now() - ctx.startedAt;
            const logLevel = ctx.status >= 500 ? 'error' : 'info';
            ctx.logger[logLevel](error ? `Http Error` : `Http Request`, {
                method: ctx.method,
                url: ctx.url,
                status: ctx.status,
                actor: ctx.state.actor,
                latency,
                agent: ctx.requestHeaders['user-agent'],
                requestId: ctx.requestHeaders['x-request-id'],
                error,
            });
            this.latency.addMillis(latency, {
                method: ctx.method,
                url: ctx.url.pathname,
                status: ctx.status,
            });
            ctx.setResponseHeader('Server-Timing', `total;dur=${latency}`);
        }
    }

}
