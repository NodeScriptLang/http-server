import { ConsoleLogger, Logger, LogLevel } from '@nodescript/logger';
import dotenv from 'dotenv';
import { Config, ProcessEnvConfig } from 'mesh-config';
import { dep, Mesh } from 'mesh-ioc';

import { HttpServer } from '../main/index.js';
import { BarMiddleware, CatchMiddleware, EndpointHandler, FooMiddleware, ThrowMiddleware } from './handlers.js';

dotenv.config();
dotenv.config({ path: '.env.test' });

export class TestRuntime {

    @dep({ cache: false }) server!: HttpServer;
    @dep({ cache: false }) logger!: Logger;
    @dep({ cache: false }) config!: Config;

    mesh = new Mesh();
    requestScope = new Mesh();
    events: string[] = [];

    async beforeEach() {
        this.mesh = new Mesh('App');
        this.requestScope = new Mesh('Request', this.mesh);
        this.mesh.connect(this);
        this.mesh.service(Logger, ConsoleLogger);
        this.mesh.service(Config, ProcessEnvConfig);
        this.mesh.service(HttpServer);
        this.mesh.constant(HttpServer.SCOPE, () => this.requestScope);
        this.requestScope.service(FooMiddleware);
        this.requestScope.service(BarMiddleware);
        this.requestScope.service(CatchMiddleware);
        this.requestScope.service(ThrowMiddleware);
        this.requestScope.service(EndpointHandler);
        this.logger.level = this.config.getString('LOG_LEVEL', 'mute') as LogLevel;
        this.events = [];
    }

    async afterEach() {
        await this.server.stop();
    }

    get port() {
        return this.server.HTTP_PORT;
    }

    getUrl(path = '/') {
        return `http://127.0.0.1:${this.port}${path}`;
    }

}

export const runtime = new TestRuntime();
