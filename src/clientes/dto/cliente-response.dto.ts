import { ApiProperty } from '@nestjs/swagger';
import { CondicionIVA } from '../cliente.entity';

// DTOs solo para documentar respuestas en Swagger.

export class ClienteResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  razonSocial!: string;

  @ApiProperty({ example: '30712345671' })
  cuit!: string;

  @ApiProperty()
  email!: string;

  @ApiProperty({ type: String, nullable: true })
  telefono!: string | null;

  @ApiProperty({ enum: CondicionIVA })
  condicionIVA!: CondicionIVA;

  @ApiProperty()
  activo!: boolean;

  @ApiProperty({ format: 'uuid' })
  adminId!: string;

  @ApiProperty({
    type: String,
    format: 'uuid',
    nullable: true,
    description:
      'Usuario de login del cliente; null si todavía no tiene acceso',
  })
  usuarioId!: string | null;

  @ApiProperty()
  createdAt!: Date;
}

export class ClientesPaginadosDto {
  @ApiProperty({ type: [ClienteResponseDto] })
  data!: ClienteResponseDto[];

  @ApiProperty()
  total!: number;

  @ApiProperty()
  page!: number;

  @ApiProperty()
  limit!: number;
}
