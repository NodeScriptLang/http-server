import { NotFoundError } from '@nodescript/errors';
import { Logger } from '@nodescript/logger';
import { DomainMethod, DomainMethodStat, ProtocolIndex } from '@nodescript/protocomm';
import { dep } from 'mesh-ioc';
import { Event } from 'nanoevent';

import { HttpContext } from '../HttpContext.js';
import { HttpHandler, HttpNext } from '../HttpHandler.js';

/**
 * Routes HTTP requests according to specified protocol.
 *
 * Handler must be created in request scope by passing protocol implementation
 * (which can also request-scoped).
 */
export abstract class HttpProtocolHandler<P> implements HttpHandler {

    @dep() logger!: Logger;

    abstract protocol: ProtocolIndex<P>;
    abstract protocolImpl: P;

    prefix = '';
    methodStats = new Event<DomainMethodStat>();

    async handle(ctx: HttpContext, next: HttpNext) {
        if (!ctx.path.startsWith(this.prefix)) {
            return await next();
        }
        const [domainName, methodName] = this.parsePath(ctx.path);
        const {
            methodDef,
            reqSchema,
            resSchema,
        } = this.protocol.lookupMethod(domainName, methodName);
        const startedAt = Date.now();
        try {
            const method = methodDef.type === 'query' ? 'GET' : 'POST';
            if (ctx.method !== method) {
                return await next();
            }
            const params = await this.parseParams(ctx);
            const decodedParams = reqSchema.decode(params, { strictRequired: true });
            this.logger.debug(`>>> ${domainName}.${methodName}`, decodedParams);
            const domainImpl = (this.protocolImpl as any)[domainName];
            const methodImpl = domainImpl[methodName] as DomainMethod<any, any>;
            ctx.state.domainName = domainName;
            ctx.state.methodName = methodName;
            ctx.state.methodDef = methodDef;
            ctx.state.params = decodedParams;
            const res = await methodImpl.call(domainImpl, decodedParams);
            const decodedRes = resSchema.decode(res);
            this.logger.debug(`<<< ${domainName}.${methodName}`, decodedRes);
            ctx.status = 200;
            ctx.responseBody = decodedRes;
            this.methodStats.emit({
                domain: domainName,
                method: methodName,
                latency: Date.now() - startedAt,
            });
        } catch (error: any) {
            this.methodStats.emit({
                domain: domainName,
                method: methodName,
                latency: Date.now() - startedAt,
                error: error.name,
            });
            throw error;
        }
    }

    protected parsePath(path: string) {
        if (!path.startsWith(this.prefix)) {
            throw new NotFoundError('Endpoint not found');
        }
        path = path.substring(this.prefix.length);
        const m = /^\/([a-zA-Z0-9]+)\/([a-zA-Z0-9]+)$/.exec(path);
        if (!m) {
            throw new NotFoundError('Endpoint not found');
        }
        return [m[1], m[2]];
    }

    protected async parseParams(ctx: HttpContext) {
        if (ctx.method === 'GET') {
            return ctx.query;
        }
        const body = await ctx.readRequestBody();
        return body ?? {};
    }

}
