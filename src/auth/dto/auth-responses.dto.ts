import { ApiProperty } from '@nestjs/swagger';
import { CondicionIVA } from '../../clientes/cliente.entity';
import { Rol } from '../../usuarios/usuario.entity';

// DTOs solo para documentar respuestas en Swagger.

export class UsuarioResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  email!: string;

  @ApiProperty({ enum: Rol })
  rol!: Rol;

  @ApiProperty()
  nombre!: string;

  @ApiProperty()
  createdAt!: Date;
}

export class LoginResponseDto {
  @ApiProperty({ description: 'JWT para el header Authorization: Bearer' })
  accessToken!: string;
}

export class ClientePerfilDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  razonSocial!: string;

  @ApiProperty({ example: '20123456786' })
  cuit!: string;

  @ApiProperty()
  email!: string;

  @ApiProperty({ type: String, nullable: true })
  telefono!: string | null;

  @ApiProperty({ enum: CondicionIVA })
  condicionIVA!: CondicionIVA;

  @ApiProperty()
  activo!: boolean;
}

export class PerfilResponseDto extends UsuarioResponseDto {
  @ApiProperty({
    type: ClientePerfilDto,
    nullable: true,
    description: 'Solo para usuarios con rol cliente; null para admin',
  })
  cliente!: ClientePerfilDto | null;
}
