import { SetMetadata } from '@nestjs/common';
import { Rol } from '../../usuarios/usuario.entity';

export const ROLES_KEY = 'roles';

/** Restringe la ruta (o el controller) a los roles indicados. */
export const Roles = (...roles: Rol[]) => SetMetadata(ROLES_KEY, roles);
