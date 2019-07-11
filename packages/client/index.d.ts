import feathers from '@ihadeed/feathers';
import authentication from '@ihadeed/authentication-client';
import errors from '@ihadeed/errors';
import rest from '@ihadeed/rest-client';
import socketio from '@ihadeed/socketio-client';

export as namespace feathers;

declare const feathersClient: FeathersClient;
export = feathersClient;

type Feathers = typeof feathers;
type FeathersAuthenticationClient = typeof authentication;
type FeathersErrors = typeof errors;
type FeathersRestClient = typeof rest;
type FeathersSocketIOClient = typeof socketio;

interface FeathersClient extends Feathers {
    authentication: FeathersAuthenticationClient;
    errors: FeathersErrors;
    rest: FeathersRestClient;
    socketio: FeathersSocketIOClient;
}
