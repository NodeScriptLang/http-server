import assert from 'assert';

import { HttpContext } from '../main/HttpContext.js';
import { EchoHandler } from './handlers.js';
import { runtime } from './runtime.js';

describe('HttpServer', () => {

    it('listens on port specified in config', async () => {
        await runtime.server.start();
        const addr = runtime.server.getServer()?.address() as any;
        assert.strictEqual(addr.port, runtime.port);
    });

    it('echoes request details', async () => {
        await runtime.server.start();
        runtime.setHandler(EchoHandler);
        const res = await fetch(runtime.getUrl('/hello?foo=one&bar=two&foo=three'), {
            method: 'post',
            headers: {
                'Content-Type': 'application/json',
                'X-Custom-Header': 'hello',
            },
            body: JSON.stringify({
                hello: 'world',
            })
        });
        assert.strictEqual(res.status, 200);
        const json = await res.json();
        assert.strictEqual(json.method, 'POST');
        assert.strictEqual(json.path, '/hello');
        assert.deepStrictEqual(json.query, {
            foo: ['one', 'three'],
            bar: ['two'],
        });
        assert.deepStrictEqual(json.headers['content-type'], ['application/json']);
        assert.deepStrictEqual(json.headers['x-custom-header'], ['hello']);
        assert.deepStrictEqual(json.body, {
            hello: 'world',
        });
    });

    it('supports binary responses', async () => {
        await runtime.server.start();
        runtime.setHandler(class {
            async handle(ctx: HttpContext) {
                ctx.responseBody = new Uint8Array([0, 1, 2, 3, 4]);
            }
        });
        const res = await fetch(runtime.getUrl('/'));
        assert.strictEqual(res.status, 200);
        assert.strictEqual(res.headers.get('content-length'), '5');
        const buffer = await res.arrayBuffer();
        assert.deepStrictEqual(new Uint8Array(buffer), new Uint8Array([0, 1, 2, 3, 4]));
    });

});
