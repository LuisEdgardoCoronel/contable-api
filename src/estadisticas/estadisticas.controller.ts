import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { UsuarioAutenticado } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { Rol } from '../usuarios/usuario.entity';
import { EstadisticasQueryDto } from './dto/estadisticas-query.dto';
import { EstadisticasResponseDto } from './dto/estadisticas-response.dto';
import { EstadisticasService } from './estadisticas.service';

@ApiTags('estadisticas')
@ApiBearerAuth()
@Roles(Rol.ADMIN)
@ApiResponse({ status: 401, description: 'No autenticado' })
@ApiResponse({ status: 403, description: 'Solo para admins' })
@Controller('estadisticas')
export class EstadisticasController {
  constructor(private readonly estadisticasService: EstadisticasService) {}

  @Get()
  @ApiResponse({
    status: 200,
    type: EstadisticasResponseDto,
    description:
      'Resumen del estudio para el dashboard: clientes, vencimientos por estado, por mes y por impuesto',
  })
  @ApiResponse({
    status: 400,
    description:
      'Fechas inválidas, desde posterior a hasta, o rango de más de 36 meses',
  })
  obtener(
    @CurrentUser() user: UsuarioAutenticado,
    @Query() query: EstadisticasQueryDto,
  ) {
    return this.estadisticasService.obtener(user, query);
  }
}
