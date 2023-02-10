import assert from 'assert';

import { HttpServer } from '../main/index.js';
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
        runtime.requestScope.service(HttpServer.HANDLER, EchoHandler);
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

});
