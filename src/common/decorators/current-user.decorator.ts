import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Rol } from '../../usuarios/usuario.entity';

/** Lo que JwtStrategy deja en `request.user`. */
export interface UsuarioAutenticado {
  id: string;
  email: string;
  rol: Rol;
  /** Solo para rol cliente: id del registro Cliente vinculado. */
  clienteId: string | null;
}

/** Inyecta el usuario logueado en un parámetro del handler. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): UsuarioAutenticado =>
    ctx.switchToHttp().getRequest<{ user: UsuarioAutenticado }>().user,
);
