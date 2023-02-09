import assert from 'assert';

import { HttpContext } from '../main/next/HttpContext.js';
import { HttpHandler } from '../main/next/HttpHandler.js';
import { HttpServer } from '../main/next/HttpServer.js';
import { runtime } from './runtime.js';

describe('HttpServer', () => {

    it('listens on port specified in config', async () => {
        await runtime.server.start();
        const addr = runtime.server.getServer()?.address() as any;
        assert.strictEqual(addr.port, runtime.port);
    });

    it('calls middleware', async () => {
        const events: string[] = [];
        class Foo implements HttpHandler {
            async handle(ctx: HttpContext) {
                events.push('foo starts');
                await ctx.next();
                events.push('foo ends');
            }
        }

        class Bar implements HttpHandler {
            async handle(ctx: HttpContext) {
                events.push('bar starts');
                await ctx.next();
                events.push('bar ends');
            }
        }

        class Baz implements HttpHandler {
            async handle(ctx: HttpContext) {
                events.push('baz starts');
                await ctx.readRequestBody();
                ctx.status = 200;
                ctx.body = 'OK';
                events.push('baz ends');
            }
        }

        runtime.requestScope.service(Foo);
        runtime.requestScope.service(Bar);
        runtime.requestScope.service(Baz);
        runtime.mesh.constant(HttpServer.HANDLERS, [Foo, Bar, Baz]);
        await runtime.server.start();
        const res = await fetch(runtime.getUrl());
        assert.strictEqual(res.status, 200);
        assert.strictEqual(await res.text(), 'OK');
        assert.deepStrictEqual(events, [
            'foo starts',
            'bar starts',
            'baz starts',
            'baz ends',
            'bar ends',
            'foo ends',
        ]);
    });

});
