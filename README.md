# Standard HTTP Server

**Status: alpha. Actively developed, new releases may break things.**

Minimal Http Server, based on [Mesh IoC](https://github.com/Mesh-IoC/mesh).

## Highlights

- 🗜 Minimal abstraction over native APIs
- 🧩 Composable handlers
- 📦 Routing and standard handlers included
- ☢️ Heavily opinionated!

## Usage

```ts
// 1. Your logic is implemented in handlers
export class FooHandler implements HttpHandler {
    async handle(ctx: HttpContext, next: HttpNext) {
        // Call next() to execute the next middleware in chain.
        // Or assign ctx.status and ctx.responseBody to end request processing
    }
}

// 2. Multiple handlers can be composed into chains
export class AppHandler implements HttpChain {
    @dep() foo!: FooHandler;
    @dep() bar!: BarHandler;
    @dep() baz!: BarHandler;

    handlers = [
        this.foo,
        this.bar,
        this.baz,
    ];
}

// 3. Bind scopes and handlers in your composition root
class App {

    globalScope = this.createGlobalScope();

    createGlobalScope() {
        const mesh = new Mesh('Global');
        // In global scope bind:
        //   - the server instance
        mesh.service(HttpServer);
        //   - a request scope factory (a function that returns Mesh instance)
        mesh.constant(HttpServer.SCOPE, () => this.createRequestScope());
        // ...
        return mesh;
    }

    createRequestScope() {
        const mesh = new Mesh('Request', this.globalScope);
        // In request scope bind the handler class. This way it can access other
        // request-scoped dependencies.
        mesh.service(HttpServer.HANDLER, AppHandler);
        // Bind other request-scoped services.
        mesh.service(FooHandler);
        mesh.service(BarHandler);
        mesh.service(BarHandler);
        // ...
        return mesh;
    }

}

// 4. Start server
await app.httpServer.start();
```

## Configuration

The following env variables are supported by Http Server by default:

- HTTP_PORT (default: 8080) - port to listen to
- HTTP_ADDRESS (default: '0.0.0.0' }) - bind address
- HTTP_TIMEOUT (default: 300_000 }) - HTTP socket timeout
- HTTP_SHUTDOWN_DELAY (default: 5_000 }) — a sleep before stopping accepting connections (useful for 0-downtime deployments in environments like k8s)
- HTTP_BODY_LIMIT (default: 5 * 1024 * 1024 }) - maximum number of bytes allowed in request body

## API Cheatsheet

### Request

#### Request URL

Request URL is parsed and is available as native `URL` object:

```ts
ctx.url.searchParams;
```

#### Query Params

Use `ctx.url.searchParams` to access query string.

Alternatively, use `ctx.query` which is a [HttpDict](#http-dict).

#### Request Headers

Get request header value:

```ts
const authorization = ctx.getRequestHeader('Authorization');
```

Request headers support multiple values, so are stored as [HttpDict](#http-dict).

```ts
ctx.requestHeaders; // { 'content-type': ['application/json'], ... }
```

#### Request body

Request body needs to be explicitly read.

```ts
const body = await ctx.readRequestBody();
```

The body type is inferred from `Content-Type` header, but can also be explicitly specified.

```ts
const jsonBody = await ctx.readRequestBody('json');
```

The following request body types are supported:

  - `json`
  - `text`
  - `urlencoded`
  - `raw`

### Response

#### Status Code

Assign status code:

```ts
ctx.status = 500;
```

Status can also be read from thrown errors by StandardMiddleware:

```ts
class AccessDeniedError extends Error {
    status = 403;
    override name = this.constructor.name;
}

throw new AccessDeniedError();
```

#### Response Headers

Set response header value:

```ts
ctx.setResponseHeader('X-Powered-By', 'NodeScript');
```

Response headers support multiple values, so are stored as [HttpDict](#http-dict).

#### Response body

Set response body:

```ts
ctx.responseBody = {
    foo: 123
};
```

The `Content-Type` and `Content-Length` headers will be inferred if not speicified explicitly.

The following response body types are supported:

  - string (text/plain)
  - JSON (application/json)
  - Buffer (application/x-octet-stream)
  - Stream (piped with chunked encoding by default)

Note: you may wish to set Content-Type explicitly if you're using Buffer or Stream.

### Misc

#### Http Dict

Request/Response Headers and parsed Query String objects support multiple values per key.

In order to provide unified type-safe access to them they are stored as `HttpDict` type,
which is just `Record<string, string[]>`.

Thus expect string arrays when accessing `ctx.requestHeaders`, `ctx.responseHeaders` or `ctx.query`.
Or use `ctx.getRequestHeader`, `ctx.setResponseHeader` and `ctx.url.searchParams` for higher-level APIs.
