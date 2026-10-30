import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { PaginacionQueryDto } from '../../common/utils/paginacion';
import { booleanoDeQuery, recortar } from '../../common/utils/transforms';

export class ListarClientesQueryDto extends PaginacionQueryDto {
  @ApiPropertyOptional({ type: Boolean })
  @Transform(booleanoDeQuery)
  @IsOptional()
  @IsBoolean()
  activo?: boolean;

  @ApiPropertyOptional({
    description:
      'Busca en razón social (sin distinguir mayúsculas) o en CUIT (acepta guiones)',
  })
  @Transform(recortar)
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  search?: string;
}
