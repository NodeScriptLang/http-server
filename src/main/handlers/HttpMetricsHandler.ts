import { generateMetricsReport } from '@nodescript/metrics';
import { dep, Mesh } from 'mesh-ioc';

import { HttpContext } from '../HttpContext.js';
import { HttpHandler, HttpNext } from '../HttpHandler.js';

export class HttpMetricsHandler implements HttpHandler {

    @dep() private mesh!: Mesh;

    async handle(ctx: HttpContext, next: HttpNext) {
        if (ctx.method === 'GET' && ctx.path === '/metrics') {
            const report = generateMetricsReport(this.mesh);
            ctx.responseBody = report;
            return;
        }
        return next();
    }
}
