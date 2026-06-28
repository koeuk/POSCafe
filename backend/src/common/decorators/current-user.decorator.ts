import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface AuthUser {
  id: number;
  username: string;
  role: string;
  // Sidebar pages a cashier may access (null = default cashier pages).
  allowedPages?: string[] | null;
}

/** Injects the authenticated user (from the JWT) into a route handler. */
export const CurrentUser = createParamDecorator(
  (data: keyof AuthUser | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user: AuthUser = request.user;
    return data ? user?.[data] : user;
  },
);
