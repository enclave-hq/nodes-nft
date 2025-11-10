import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * Decorator to extract current user from request
 * Usage: @CurrentUser() username: string
 * Returns the username from JWT payload
 */
export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    // JWT strategy returns { username, userId }
    // For backward compatibility, return username as adminAddress
    return request.user?.username || request.user?.address;
  },
);

