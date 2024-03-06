import assert from 'assert';

import { HttpContext } from '../main/HttpContext.js';
import { HttpNext } from '../main/HttpHandler.js';
import { HttpRoute } from '../main/HttpRoute.js';
import { HttpRouter } from '../main/HttpRouter.js';
import { runtime } from './runtime.js';

describe('HttpRouter', () => {

    class Handler extends HttpRouter {

        routes: HttpRoute[] = [
            ['*', '/hello/*', (ctx, next) => this.beforeHello(ctx, next)],
            ['GET', '/hello', ctx => this.hello(ctx)],
            ['GET', '/hello/{name}', ctx => this.hello(ctx)],
            ['POST', '/respond/{code}', ctx => this.respondWithCode(ctx)],
        ];

        async beforeHello(ctx: HttpContext, next: HttpNext) {
            runtime.events.push('beforeHello');
            ctx.setResponseHeader('X-Route-Name', 'hello');
            await next();
        }

        async hello(ctx: HttpContext) {
            const { name } = ctx.params;
            ctx.status = 200;
            ctx.responseBody = name ? `Hello, ${name}!` : `Hello World!`;
            runtime.events.push('hello');
        }

        async respondWithCode(ctx: HttpContext) {
            const { code } = ctx.params;
            ctx.status = Number(code);
            ctx.responseBody = { code };
        }
    }

    it('matches simple route', async () => {
        runtime.setHandler(Handler);
        await runtime.server.start();
        const res = await fetch(runtime.getUrl('/hello'));
        assert.strictEqual(res.status, 200);
        assert.strictEqual(await res.text(), 'Hello World!');
    });

    it('matches route with path param', async () => {
        runtime.setHandler(Handler);
        await runtime.server.start();
        const res = await fetch(runtime.getUrl('/hello/All'));
        assert.strictEqual(res.status, 200);
        assert.strictEqual(await res.text(), 'Hello, All!');
    });

    it('executes route middleware', async () => {
        runtime.setHandler(Handler);
        await runtime.server.start();
        const res = await fetch(runtime.getUrl('/hello/All'));
        assert.strictEqual(res.status, 200);
        assert.deepStrictEqual(runtime.events, ['beforeHello', 'hello']);
        assert.deepStrictEqual(res.headers.get('x-route-name'), 'hello');
    });

    it('matches POST requests', async () => {
        runtime.setHandler(Handler);
        await runtime.server.start();
        const res = await fetch(runtime.getUrl('/respond/403'), {
            method: 'POST',
        });
        assert.strictEqual(res.status, 403);
    });

    it('calls next() if nothing matches', async () => {
        runtime.setHandler(Handler);
        await runtime.server.start();
        const res = await fetch(runtime.getUrl('/wut'));
        assert.strictEqual(res.status, 404);
    });

});
