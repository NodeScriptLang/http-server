import fs from 'node:fs';

import { HttpContext, HttpHandler, HttpNext } from '@nodescript/http-server';
import { dep, Mesh } from 'mesh-ioc';

import { invokeStatusChecks } from '../status-check.js';

const pkg = JSON.parse(fs.readFileSync('package.json', 'utf-8'));

export class HttpStatusHandler implements HttpHandler {

    @dep() private mesh!: Mesh;

    async handle(ctx: HttpContext, next: HttpNext) {
        if (ctx.method === 'GET' && ctx.path === '/status') {
            return await this.runStatusChecks(ctx);
        }
        return next();
    }

    async runStatusChecks(ctx: HttpContext) {
        const checks = await invokeStatusChecks(this.mesh);
        ctx.responseBody = {
            version: pkg.version,
            ...checks,
        };
        ctx.status = 200;
    }

}
