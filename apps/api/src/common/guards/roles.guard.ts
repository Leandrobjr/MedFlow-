import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '../shared-types';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles) {
      return true;
    }
    const { user } = context.switchToHttp().getRequest();
    
    // Normalizar role do usuário para uppercase para comparação case-insensitive
    const userRole = user.role?.toUpperCase();
    
    // Verificar se o role do usuário está entre os roles permitidos
    return requiredRoles.some((role) => {
      const requiredRole = role.toUpperCase();
      return userRole === requiredRole;
    });
  }
}


