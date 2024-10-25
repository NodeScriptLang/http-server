import { HttpContext, HttpHandler, HttpNext } from '../main/index.js';
import { runtime } from './runtime.js';

export class FooMiddleware implements HttpHandler {

    async handle(ctx: HttpContext, next: HttpNext) {
        runtime.events.push('foo start');
        await next();
        runtime.events.push('foo end');
    }

}

export class BarMiddleware implements HttpHandler {

    async handle(ctx: HttpContext, next: HttpNext) {
        runtime.events.push('bar start');
        await next();
        runtime.events.push('bar end');
    }

}

export class CatchMiddleware implements HttpHandler {

    async handle(ctx: HttpContext, next: HttpNext) {
        try {
            runtime.events.push('catch start');
            await next();
            runtime.events.push('catch end');
        } catch (error: any) {
            runtime.events.push('caught');
            ctx.status = 500;
            ctx.responseBody = error.message;
        }
    }

}

export class ThrowMiddleware implements HttpHandler {

    async handle() {
        runtime.events.push('throw');
        throw new Error('Oops!');
    }

}

export class EndpointHandler implements HttpHandler {

    async handle(ctx: HttpContext) {
        runtime.events.push('endpoint start');
        ctx.status = 200;
        ctx.responseBody = 'OK';
        runtime.events.push('endpoint end');
    }

}

export class EchoHandler implements HttpHandler {

    async handle(ctx: HttpContext) {
        const body = await ctx.readRequestBody();
        ctx.status = 200;
        ctx.responseBody = {
            method: ctx.method,
            path: ctx.url.pathname,
            query: ctx.query,
            headers: ctx.requestHeaders,
            body,
        };
    }

}
