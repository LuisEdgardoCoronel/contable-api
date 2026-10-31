import { ApiProperty } from '@nestjs/swagger';
import { ImpuestoResponseDto } from '../../impuestos/dto/impuesto-response.dto';
import { EstadoActual, EstadoVencimiento } from '../vencimiento.entity';

// DTOs solo para documentar respuestas en Swagger.

export class VencimientoClienteDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  razonSocial!: string;

  @ApiProperty({ example: '30712345671' })
  cuit!: string;
}

export class VencimientoResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  clienteId!: string;

  @ApiProperty({ type: VencimientoClienteDto })
  cliente!: VencimientoClienteDto;

  @ApiProperty({ format: 'uuid' })
  impuestoId!: string;

  @ApiProperty({ type: ImpuestoResponseDto })
  impuesto!: ImpuestoResponseDto;

  @ApiProperty({ example: '2026-11-18' })
  fechaVencimiento!: string;

  @ApiProperty({ example: '2026-10' })
  periodo!: string;

  @ApiProperty({
    enum: EstadoVencimiento,
    description: 'Estado guardado',
  })
  estado!: EstadoVencimiento;

  @ApiProperty({
    enum: EstadoActual,
    description:
      'Estado calculado: `vencido` si está pendiente y la fecha ya pasó (hora de Argentina)',
  })
  estadoActual!: EstadoActual;

  @ApiProperty({ type: String, nullable: true, example: null })
  fechaPresentacion!: string | null;

  @ApiProperty({ type: String, nullable: true })
  notas!: string | null;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}

export class VencimientosPaginadosDto {
  @ApiProperty({ type: [VencimientoResponseDto] })
  data!: VencimientoResponseDto[];

  @ApiProperty()
  total!: number;

  @ApiProperty()
  page!: number;

  @ApiProperty()
  limit!: number;
}
