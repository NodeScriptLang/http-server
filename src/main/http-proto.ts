import { Logger } from '@flexent/logger';
import { dep } from '@flexent/mesh';
import { DomainMethod, ProtocolIndex } from '@flexent/protocomm';
import { Context, Next } from 'koa';

import { NotFoundError } from './errors.js';
import { RequestHandler } from './http-server.js';

/**
 * Routes HTTP requests according to specified protocol.
 *
 * Handler must be created in request scope by passing protocol implementation
 * (which can also request-scoped).
 */
export abstract class HttpProtocolHandler<P> implements RequestHandler {

    @dep() logger!: Logger;

    abstract protocol: ProtocolIndex<P>;
    abstract protocolImpl: P;

    prefix = '/';

    async handle(ctx: Context, next: Next) {
        const [domainName, methodName] = this.parsePath(ctx.path);
        const {
            methodDef,
            reqSchema,
            resSchema,
        } = this.protocol.lookupMethod(domainName, methodName);
        const method = methodDef.type === 'query' ? 'GET' : 'POST';
        if (ctx.method !== method) {
            return await next();
        }
        const params = this.parseParams(ctx);
        const decodedParams = reqSchema.decode(params, { strictRequired: true });
        this.logger.debug(`>>> ${domainName}.${methodName}`, decodedParams);
        const domainImpl = (this.protocolImpl as any)[domainName];
        const methodImpl = domainImpl[methodName] as DomainMethod<any, any>;
        const res = await methodImpl.call(domainImpl, decodedParams);
        const decoded = resSchema.decode(res);
        this.logger.debug(`<<< ${domainName}.${methodName}`, decoded);
        ctx.body = decoded;
    }

    protected parsePath(path: string) {
        if (!path.startsWith(this.prefix)) {
            throw new NotFoundError('Endpoint not found');
        }
        path = path.substring(this.prefix.length);
        const m = /^([a-zA-Z0-9]+)\/([a-zA-Z0-9]+)$/.exec(path);
        if (!m) {
            throw new NotFoundError('Endpoint not found');
        }
        return [m[1], m[2]];
    }

    protected parseParams(ctx: Context) {
        if (ctx.method === 'GET') {
            return ctx.query;
        }
        return (ctx.request as any).body || {};
    }

}
