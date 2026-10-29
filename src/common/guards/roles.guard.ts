import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UsuarioAutenticado } from '../decorators/current-user.decorator';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { Rol } from '../../usuarios/usuario.entity';

/**
 * Guard global: si la ruta tiene @Roles(...), el usuario debe tener uno de
 * esos roles (si no, 403). Sin @Roles, deja pasar a cualquier autenticado.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<Rol[] | undefined>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!roles || roles.length === 0) {
      return true;
    }
    const user = context
      .switchToHttp()
      .getRequest<{ user?: UsuarioAutenticado }>().user;
    return !!user && roles.includes(user.rol);
  }
}
