import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { recortarONull } from '../../common/utils/transforms';
import { IsFecha } from '../../common/validators/is-fecha.validator';
import { EstadoVencimiento } from '../vencimiento.entity';
import { NOTAS_MAX } from './crear-vencimiento.dto';

/** Todos los campos son opcionales: solo se cambia lo que se envía. */
export class ActualizarVencimientoDto {
  @ApiPropertyOptional({
    enum: EstadoVencimiento,
    description:
      'Al pasar a `presentado` se completa `fechaPresentacion`; al volver a `pendiente` se borra',
  })
  @IsOptional()
  @IsEnum(EstadoVencimiento)
  estado?: EstadoVencimiento;

  @ApiPropertyOptional({
    example: '2026-11-15',
    description:
      'Solo si el vencimiento queda `presentado`. Default: hoy (Argentina). No puede ser futura',
  })
  @IsOptional()
  @IsFecha()
  fechaPresentacion?: string;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    maxLength: NOTAS_MAX,
    description: 'null o vacío borra las notas',
  })
  @Transform(recortarONull)
  @IsOptional()
  @IsString()
  @MaxLength(NOTAS_MAX)
  notas?: string | null;
}
