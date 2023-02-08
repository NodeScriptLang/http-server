import { ServiceConstructor } from 'mesh-ioc';

import { HttpContext } from './HttpContext.js';

export interface HttpHandler {
    handle(ctx: HttpContext): Promise<any>;
}

export type HttpHandlerClass = ServiceConstructor<HttpHandler>;
