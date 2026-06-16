/**
|--------------------------------------------------
| Npm imports
|--------------------------------------------------
*/
import { Injectable, createParamDecorator, type CanActivate, type ExecutionContext } from '@nestjs/common';

/**
|--------------------------------------------------
| Custom imports
|--------------------------------------------------
*/
import { verifyToken } from './token.js';

/**
|--------------------------------------------------
| Anonymous user identifier
|--------------------------------------------------
*/
export const ANONYMOUS_USER = 'anonymous';

/**
|--------------------------------------------------
| Resolve the user id from the bearer token
|--------------------------------------------------
| Optional auth: a valid token scopes data to the user;
| absence or invalidity falls back to "anonymous".
|--------------------------------------------------
*/
@Injectable()
export class AuthContextGuard implements CanActivate {
	/**
	|--------------------------------------------------
	| Attach a resolved user id to the request
	|--------------------------------------------------
	*/
	canActivate(context: ExecutionContext): boolean {
		/**
		|--------------------------------------------------
		| Read the bearer token from the request
		|--------------------------------------------------
		*/
		const request = context.switchToHttp().getRequest();
		const header: string = request.headers?.authorization || '';
		const token = header.startsWith('Bearer ') ? header.slice(7) : '';

		/**
		|--------------------------------------------------
		| Resolve the user id, defaulting to anonymous
		|--------------------------------------------------
		*/
		request.userId = (token && verifyToken(token)) || ANONYMOUS_USER;
		return true;
	}
}

/**
|--------------------------------------------------
| Inject the resolved user id into a handler
|--------------------------------------------------
*/
export const CurrentUser = createParamDecorator((_: unknown, context: ExecutionContext): string => {
	/**
	|--------------------------------------------------
	| Return the resolved user id
	|--------------------------------------------------
	*/
	return context.switchToHttp().getRequest().userId || ANONYMOUS_USER;
});
