import { ExecutionContext, createParamDecorator } from '@nestjs/common';
import { UserContext } from '../interfaces/data-scope.interface';

/**
 * Decorator to extract user context from request
 */
export const User = createParamDecorator(
    (data: keyof UserContext | undefined, ctx: ExecutionContext): UserContext | any => {
        const request = ctx.switchToHttp().getRequest();
        const user = request.user as UserContext;

        return data ? user?.[data] : user;
    }
);
