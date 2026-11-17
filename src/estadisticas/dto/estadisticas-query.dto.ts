import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional } from 'class-validator';
import { IsFecha } from '../../common/validators/is-fecha.validator';

export class EstadisticasQueryDto {
  @ApiPropertyOptional({
    example: '2026-06-01',
    description:
      'Inicio del rango para `porMes` y `porImpuesto` (inclusive). Default: primer día del mes de hace 5 meses',
  })
  @IsOptional()
  @IsFecha()
  desde?: string;

  @ApiPropertyOptional({
    example: '2026-11-30',
    description:
      'Fin del rango (inclusive). Default: último día del mes actual (hora de Argentina)',
  })
  @IsOptional()
  @IsFecha()
  hasta?: string;
}
