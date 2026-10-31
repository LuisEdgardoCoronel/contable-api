import { ApiProperty } from '@nestjs/swagger';
import { CodigoImpuesto, Periodicidad } from '../impuesto.entity';

// Solo para documentar respuestas en Swagger.
export class ImpuestoResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ enum: CodigoImpuesto, example: CodigoImpuesto.IVA })
  codigo!: string;

  @ApiProperty({ example: 'IVA' })
  nombre!: string;

  @ApiProperty({
    enum: Periodicidad,
    description:
      'Define el formato de `periodo`: YYYY-MM (mensual) o YYYY (anual)',
  })
  periodicidad!: Periodicidad;
}
