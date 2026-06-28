import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  DEFAULT_CASHIER_PAGES,
  PAGE_KEY,
} from '../../common/decorators/requires-page.decorator';
import { ROLES_KEY } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const requiredPages = this.reflector.getAllAndOverride<string[]>(PAGE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const hasRoles = !!requiredRoles && requiredRoles.length > 0;
    const hasPages = !!requiredPages && requiredPages.length > 0;

    // No @Roles()/@RequiresPage() on the route → any authenticated user.
    if (!hasRoles && !hasPages) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();

    // Admins can access everything.
    if (user?.role === Role.ADMIN) {
      return true;
    }

    if (hasRoles && requiredRoles.some((role) => user?.role === role)) {
      return true;
    }

    if (hasPages) {
      // null allowedPages = legacy cashier → default pages (see user entity).
      const allowed: string[] = user?.allowedPages ?? DEFAULT_CASHIER_PAGES;
      return requiredPages.some((page) => allowed.includes(page));
    }

    return false;
  }
}
