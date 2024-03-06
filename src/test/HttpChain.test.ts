import assert from 'assert';
import { dep } from 'mesh-ioc';

import { HttpChain } from '../main/index.js';
import { BarMiddleware, CatchMiddleware, EndpointHandler, FooMiddleware, ThrowMiddleware } from './handlers.js';
import { runtime } from './runtime.js';

describe('HttpChain', () => {

    it('calls middlware in order', async () => {
        class Handler extends HttpChain {
            @dep() foo!: FooMiddleware;
            @dep() bar!: BarMiddleware;
            @dep() endpoint!: EndpointHandler;
            handlers = [
                this.foo,
                this.bar,
                this.endpoint,
            ];
        }
        runtime.setHandler(Handler);
        await runtime.server.start();
        const res = await fetch(runtime.getUrl());
        assert.strictEqual(res.status, 200);
        assert.strictEqual(await res.text(), 'OK');
        assert.deepStrictEqual(runtime.events, [
            'foo start',
            'bar start',
            'endpoint start',
            'endpoint end',
            'bar end',
            'foo end',
        ]);
    });

    it('allows catching and throwing with middleware', async () => {
        class Handler extends HttpChain {
            @dep() foo!: FooMiddleware;
            @dep() catch!: CatchMiddleware;
            @dep() throw!: ThrowMiddleware;
            handlers = [
                this.foo,
                this.catch,
                this.throw,
            ];
        }
        runtime.setHandler(Handler);
        await runtime.server.start();
        const res = await fetch(runtime.getUrl());
        assert.strictEqual(res.status, 500);
        assert.strictEqual(await res.text(), 'Oops!');
        assert.deepStrictEqual(runtime.events, [
            'foo start',
            'catch start',
            'throw',
            'caught',
            'foo end',
        ]);
    });

});
