import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/** Marca una ruta como pública: el JwtAuthGuard global no exige token. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
