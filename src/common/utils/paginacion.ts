import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export const LIMIT_DEFAULT = 20;
export const LIMIT_MAXIMO = 100;

/** Query params `page` y `limit`. Extender en los DTOs de cada listado. */
export class PaginacionQueryDto {
  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({
    minimum: 1,
    maximum: LIMIT_MAXIMO,
    default: LIMIT_DEFAULT,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(LIMIT_MAXIMO)
  limit: number = LIMIT_DEFAULT;
}

export interface Paginado<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

/** `skip`/`take` para TypeORM a partir de los query params. */
export function skipTake({ page, limit }: PaginacionQueryDto): {
  skip: number;
  take: number;
} {
  return { skip: (page - 1) * limit, take: limit };
}

/** Escapa `%`, `_` y `\` para usar texto del usuario dentro de un LIKE. */
export function escaparLike(texto: string): string {
  return texto.replace(/[\\%_]/g, '\\$&');
}
