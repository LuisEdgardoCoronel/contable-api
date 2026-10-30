import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { UsuarioResponseDto } from '../auth/dto/auth-responses.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { UsuarioAutenticado } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { Rol } from '../usuarios/usuario.entity';
import { ClientesService } from './clientes.service';
import { ActualizarClienteDto } from './dto/actualizar-cliente.dto';
import {
  ClienteResponseDto,
  ClientesPaginadosDto,
} from './dto/cliente-response.dto';
import { CrearAccesoDto } from './dto/crear-acceso.dto';
import { CrearClienteDto } from './dto/crear-cliente.dto';
import { ListarClientesQueryDto } from './dto/listar-clientes-query.dto';

const idParam = new ParseUUIDPipe();

@ApiTags('clientes')
@ApiBearerAuth()
@Roles(Rol.ADMIN)
@ApiResponse({ status: 401, description: 'No autenticado' })
@ApiResponse({ status: 403, description: 'Solo para admins' })
@Controller('clientes')
export class ClientesController {
  constructor(private readonly clientesService: ClientesService) {}

  @Get()
  @ApiResponse({ status: 200, type: ClientesPaginadosDto })
  @ApiResponse({ status: 400, description: 'Query params inválidos' })
  listar(
    @CurrentUser() user: UsuarioAutenticado,
    @Query() query: ListarClientesQueryDto,
  ) {
    return this.clientesService.listar(user.id, query);
  }

  @Get(':id')
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 200, type: ClienteResponseDto })
  @ApiResponse({ status: 404, description: 'Cliente no encontrado' })
  obtener(
    @CurrentUser() user: UsuarioAutenticado,
    @Param('id', idParam) id: string,
  ) {
    return this.clientesService.obtener(user.id, id);
  }

  @Post()
  @ApiResponse({ status: 201, type: ClienteResponseDto })
  @ApiResponse({ status: 400, description: 'Datos inválidos (incluye CUIT)' })
  @ApiResponse({
    status: 409,
    description: 'Ya existe un cliente con ese CUIT',
  })
  crear(@CurrentUser() user: UsuarioAutenticado, @Body() dto: CrearClienteDto) {
    return this.clientesService.crear(user.id, dto);
  }

  @Put(':id')
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 200, type: ClienteResponseDto })
  @ApiResponse({ status: 400, description: 'Datos inválidos (incluye CUIT)' })
  @ApiResponse({ status: 404, description: 'Cliente no encontrado' })
  @ApiResponse({
    status: 409,
    description: 'Ya existe un cliente con ese CUIT',
  })
  actualizar(
    @CurrentUser() user: UsuarioAutenticado,
    @Param('id', idParam) id: string,
    @Body() dto: ActualizarClienteDto,
  ) {
    return this.clientesService.actualizar(user.id, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({
    status: 204,
    description:
      'Cliente dado de baja (activo = false). Su usuario ya no puede loguearse',
  })
  @ApiResponse({ status: 404, description: 'Cliente no encontrado' })
  darDeBaja(
    @CurrentUser() user: UsuarioAutenticado,
    @Param('id', idParam) id: string,
  ) {
    return this.clientesService.darDeBaja(user.id, id);
  }

  @Post(':id/acceso')
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({
    status: 201,
    description: 'Usuario con rol cliente creado y vinculado',
    type: UsuarioResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Datos inválidos' })
  @ApiResponse({ status: 404, description: 'Cliente no encontrado' })
  @ApiResponse({
    status: 409,
    description:
      'El cliente ya tiene acceso, está dado de baja, o el email ya está registrado',
  })
  crearAcceso(
    @CurrentUser() user: UsuarioAutenticado,
    @Param('id', idParam) id: string,
    @Body() dto: CrearAccesoDto,
  ) {
    return this.clientesService.crearAcceso(user.id, id, dto);
  }
}
