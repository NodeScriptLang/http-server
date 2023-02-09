import { HttpContext } from './HttpContext.js';

export interface HttpHandler {
    handle(ctx: HttpContext): Promise<any>;
}
