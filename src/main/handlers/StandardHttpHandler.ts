import { ServerError } from '@nodescript/errors';
import { Logger, StructuredLogHttpRequest } from '@nodescript/logger';
import { HistogramMetric, metric } from '@nodescript/metrics';
import { dep } from 'mesh-ioc';

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

    @dep() private logger!: Logger;

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
                details: presentedErr.details,
            };
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
            this.logger[logLevel](error ? `Http Error` : `Http Request`, {
                httpRequest,
                actor: ctx.state.actor,
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
