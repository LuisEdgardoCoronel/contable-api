import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
} from 'class-validator';
import { recortar, recortarONull } from '../../common/utils/transforms';
import { IsFecha } from '../../common/validators/is-fecha.validator';

export const NOTAS_MAX = 2000;

export class CrearVencimientoDto {
  @ApiProperty({ format: 'uuid', description: 'Cliente del estudio, activo' })
  @IsUUID()
  clienteId!: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  impuestoId!: string;

  @ApiProperty({ example: '2026-11-18', description: 'YYYY-MM-DD' })
  @IsFecha()
  fechaVencimiento!: string;

  @ApiProperty({
    example: '2026-10',
    description:
      'YYYY-MM si el impuesto es mensual, YYYY si es anual (ver GET /impuestos)',
  })
  @Transform(recortar)
  @IsString()
  @Matches(/^\d{4}(-(0[1-9]|1[0-2]))?$/, {
    message: 'periodo debe tener formato YYYY-MM o YYYY',
  })
  periodo!: string;

  @ApiPropertyOptional({ type: String, nullable: true, maxLength: NOTAS_MAX })
  @Transform(recortarONull)
  @IsOptional()
  @IsString()
  @MaxLength(NOTAS_MAX)
  notas?: string | null;
}
