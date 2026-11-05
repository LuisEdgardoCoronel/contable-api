import { ApiProperty } from '@nestjs/swagger';
import { CodigoImpuesto } from '../../impuestos/impuesto.entity';

// DTOs para documentar la respuesta en Swagger y tipar el service.

export class RangoDto {
  @ApiProperty({ example: '2026-06-01' })
  desde!: string;

  @ApiProperty({ example: '2026-11-30' })
  hasta!: string;
}

export class ConteoClientesDto {
  @ApiProperty({ example: 12 })
  activos!: number;

  @ApiProperty({ example: 2 })
  inactivos!: number;
}

export class ConteoEstadosDto {
  @ApiProperty({ example: 8, description: 'Pendientes no vencidos' })
  pendientes!: number;

  @ApiProperty({
    example: 3,
    description: 'Pendientes con fecha anterior a hoy',
  })
  vencidos!: number;

  @ApiProperty({ example: 40 })
  presentados!: number;
}

export class ConteoVencimientosDto extends ConteoEstadosDto {
  @ApiProperty({
    example: 5,
    description:
      'No presentados que vencen entre hoy y hoy + 30 días, de clientes activos (igual que /vencimientos/proximos)',
  })
  proximos30Dias!: number;
}

export class ConteoMesDto extends ConteoEstadosDto {
  @ApiProperty({ example: '2026-06', description: 'Mes (`YYYY-MM`)' })
  mes!: string;
}

export class ImpuestoResumenDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ enum: CodigoImpuesto, example: CodigoImpuesto.IVA })
  codigo!: string;

  @ApiProperty({ example: 'IVA' })
  nombre!: string;
}

export class ConteoImpuestoDto extends ConteoEstadosDto {
  @ApiProperty({ type: ImpuestoResumenDto })
  impuesto!: ImpuestoResumenDto;
}

export class EstadisticasResponseDto {
  @ApiProperty({
    example: '2026-11-05',
    description: 'Fecha de corte (hoy en Argentina) usada para los cálculos',
  })
  hoy!: string;

  @ApiProperty({
    type: RangoDto,
    description: 'Rango aplicado a `porMes` y `porImpuesto`',
  })
  rango!: RangoDto;

  @ApiProperty({ type: ConteoClientesDto })
  clientes!: ConteoClientesDto;

  @ApiProperty({
    type: ConteoVencimientosDto,
    description:
      'Totales sin rango de fechas, incluidos los clientes dados de baja (coinciden con GET /vencimientos?estado=...)',
  })
  vencimientos!: ConteoVencimientosDto;

  @ApiProperty({
    type: [ConteoMesDto],
    description:
      'Por mes de vencimiento dentro del rango. Incluye los meses sin vencimientos (en cero)',
  })
  porMes!: ConteoMesDto[];

  @ApiProperty({
    type: [ConteoImpuestoDto],
    description:
      'Por impuesto dentro del rango, solo los que tienen vencimientos. Ordenados por nombre',
  })
  porImpuesto!: ConteoImpuestoDto[];
}
