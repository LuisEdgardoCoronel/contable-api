import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';
import { CrearClienteDto } from './crear-cliente.dto';

/**
 * PUT reemplaza los datos del cliente: los mismos campos obligatorios que al
 * crear. `telefono` omitido queda en null; `activo` omitido no cambia.
 */
export class ActualizarClienteDto extends CrearClienteDto {
  @ApiPropertyOptional({
    description:
      'Permite reactivar un cliente dado de baja (o darlo de baja). Si se omite, no cambia',
  })
  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}
