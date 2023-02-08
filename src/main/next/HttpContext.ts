import { IncomingMessage, ServerResponse } from 'http';
import { Mesh } from 'mesh-ioc';

import { HttpHandler } from './HttpHandler.js';
import { HttpServer } from './HttpServer.js';

export class HttpContext {

    startedAt = Date.now();
    index = 0;

    constructor(
        readonly server: HttpServer,
        readonly mesh: Mesh,
        readonly req: IncomingMessage,
        readonly res: ServerResponse,
    ) {
        // TODO parse request URL
        // TODO add request headers get
        // TODO add response headers get+set
        // TODO add query parser
        // TODO add body parser
    }

    async next() {
        this.index += 1;
        const handlerClass = this.server.handlers[this.index];
        const handler = this.mesh.resolve<HttpHandler>(handlerClass);
        await handler.handle(this);
    }

}
