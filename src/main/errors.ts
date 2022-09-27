import { Exception } from '@flexent/exception';

export class ClientError extends Exception {
    override status = 400;
}

export class NotFoundError extends Exception {
    override status = 404;

    constructor(message: string = 'Resource not found') {
        super(message);
    }
}

export class ConflictError extends Exception {
    override status = 409;

    constructor(message: string = 'The requested operation results in a conflict, please try again soon') {
        super(message);
    }
}

export class AuthenticationRequiredError extends Exception {
    override status = 401;

    constructor() {
        super('Authentication is required');
    }
}

export class ServerError extends Exception {
    override status = 500;

    constructor(message = 'The request cannot be processed') {
        super(message);
    }
}
