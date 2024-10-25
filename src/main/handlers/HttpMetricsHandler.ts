import { generateMetricsReport } from '@nodescript/metrics';
import { dep, Mesh } from 'mesh-ioc';

import { HttpContext } from '../HttpContext.js';
import { HttpHandler, HttpNext } from '../HttpHandler.js';

export class HttpMetricsHandler implements HttpHandler {

    @dep() private mesh!: Mesh;

    async handle(ctx: HttpContext, next: HttpNext) {
        if (ctx.method === 'GET' && ctx.path === '/metrics') {
            return this.serveMetrics(ctx);
        }
        return next();
    }

    private serveMetrics(ctx: HttpContext) {
        const report = generateMetricsReport(this.mesh);
        ctx.status = 200;
        ctx.responseBody = report;
        ctx.log = false;
    }

}
