import { HttpContext } from './HttpContext.js';

export type HttpNext = () => Promise<void>;

export type HttpHandlerFn = (ctx: HttpContext, next: HttpNext) => Promise<void>;

export interface HttpHandler {
    handle(ctx: HttpContext, next: HttpNext): Promise<void>;
}
