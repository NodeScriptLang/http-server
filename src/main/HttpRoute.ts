import { HttpHandlerFn } from './HttpHandler.js';

export type HttpRouteMethod = '*' | 'GET' | 'HEAD' | 'POST' | 'PUT' | 'DELETE';

export type HttpRoute = [HttpRouteMethod, string, HttpHandlerFn];
