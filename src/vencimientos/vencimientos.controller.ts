import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { UsuarioAutenticado } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { PaginacionQueryDto } from '../common/utils/paginacion';
import { Rol } from '../usuarios/usuario.entity';
import { ActualizarVencimientoDto } from './dto/actualizar-vencimiento.dto';
import { CrearVencimientoDto } from './dto/crear-vencimiento.dto';
import { ListarVencimientosQueryDto } from './dto/listar-vencimientos-query.dto';
import {
  VencimientoResponseDto,
  VencimientosPaginadosDto,
} from './dto/vencimiento-response.dto';
import { VencimientosService } from './vencimientos.service';

const idParam = new ParseUUIDPipe();

@ApiTags('vencimientos')
@ApiBearerAuth()
@ApiResponse({ status: 401, description: 'No autenticado' })
@Controller('vencimientos')
export class VencimientosController {
  constructor(private readonly vencimientosService: VencimientosService) {}

  @Get()
  @ApiResponse({
    status: 200,
    type: VencimientosPaginadosDto,
    description:
      'Admin: los de sus clientes. Cliente: los propios. Ordenados por fecha de vencimiento',
  })
  @ApiResponse({ status: 400, description: 'Query params inválidos' })
  listar(
    @CurrentUser() user: UsuarioAutenticado,
    @Query() query: ListarVencimientosQueryDto,
  ) {
    return this.vencimientosService.listar(user, query);
  }

  // Tiene que ir antes de GET :id para que "proximos" no se tome como id.
  @Get('proximos')
  @ApiResponse({
    status: 200,
    type: VencimientosPaginadosDto,
    description:
      'Pendientes que vencen entre hoy y hoy + 30 días (hora de Argentina), por fecha',
  })
  proximos(
    @CurrentUser() user: UsuarioAutenticado,
    @Query() query: PaginacionQueryDto,
  ) {
    return this.vencimientosService.proximos(user, query);
  }

  @Get(':id')
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 200, type: VencimientoResponseDto })
  @ApiResponse({ status: 404, description: 'Vencimiento no encontrado' })
  obtener(
    @CurrentUser() user: UsuarioAutenticado,
    @Param('id', idParam) id: string,
  ) {
    return this.vencimientosService.obtener(user, id);
  }

  @Post()
  @Roles(Rol.ADMIN)
  @ApiResponse({ status: 201, type: VencimientoResponseDto })
  @ApiResponse({
    status: 400,
    description: 'Datos inválidos (incluye periodo según periodicidad)',
  })
  @ApiResponse({ status: 403, description: 'Solo para admins' })
  @ApiResponse({ status: 404, description: 'Cliente o impuesto no encontrado' })
  @ApiResponse({
    status: 409,
    description:
      'El cliente está dado de baja, o ya existe un vencimiento de ese impuesto y período',
  })
  crear(
    @CurrentUser() user: UsuarioAutenticado,
    @Body() dto: CrearVencimientoDto,
  ) {
    return this.vencimientosService.crear(user, dto);
  }

  @Patch(':id')
  @Roles(Rol.ADMIN)
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 200, type: VencimientoResponseDto })
  @ApiResponse({ status: 400, description: 'Datos inválidos' })
  @ApiResponse({ status: 403, description: 'Solo para admins' })
  @ApiResponse({ status: 404, description: 'Vencimiento no encontrado' })
  actualizar(
    @CurrentUser() user: UsuarioAutenticado,
    @Param('id', idParam) id: string,
    @Body() dto: ActualizarVencimientoDto,
  ) {
    return this.vencimientosService.actualizar(user, id, dto);
  }

  @Delete(':id')
  @Roles(Rol.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 204, description: 'Vencimiento eliminado' })
  @ApiResponse({ status: 403, description: 'Solo para admins' })
  @ApiResponse({ status: 404, description: 'Vencimiento no encontrado' })
  eliminar(
    @CurrentUser() user: UsuarioAutenticado,
    @Param('id', idParam) id: string,
  ) {
    return this.vencimientosService.eliminar(user, id);
  }
}
