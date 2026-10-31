import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { PaginacionQueryDto } from '../../common/utils/paginacion';
import { IsFecha } from '../../common/validators/is-fecha.validator';
import { EstadoActual } from '../vencimiento.entity';

export class ListarVencimientosQueryDto extends PaginacionQueryDto {
  @ApiPropertyOptional({
    enum: EstadoActual,
    description:
      'Filtra por estado actual: `pendiente` (no vencido), `vencido` (pendiente con fecha pasada) o `presentado`',
  })
  @IsOptional()
  @IsEnum(EstadoActual)
  estado?: EstadoActual;

  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'Solo tiene sentido para admin. Un usuario cliente solo ve los suyos',
  })
  @IsOptional()
  @IsUUID()
  clienteId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  impuestoId?: string;

  @ApiPropertyOptional({
    example: '2026-11-01',
    description: 'Fecha de vencimiento desde (inclusive)',
  })
  @IsOptional()
  @IsFecha()
  desde?: string;

  @ApiPropertyOptional({
    example: '2026-11-30',
    description: 'Fecha de vencimiento hasta (inclusive)',
  })
  @IsOptional()
  @IsFecha()
  hasta?: string;
}
