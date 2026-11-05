import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ThrottlerGuard } from '@nestjs/throttler';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { UsuarioAutenticado } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { AuthService } from './auth.service';
import {
  LoginResponseDto,
  PerfilResponseDto,
  UsuarioResponseDto,
} from './dto/auth-responses.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register')
  @ApiResponse({
    status: 201,
    description: 'Admin creado (el campo rol del body se ignora)',
    type: UsuarioResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Datos inválidos' })
  @ApiResponse({ status: 409, description: 'El email ya está registrado' })
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  // Rate limit por IP (ver AuthModule). Detrás de un proxy (Railway) hay que
  // configurar `trust proxy` en Express; si no, req.ip es la del proxy y todos
  // los usuarios comparten el mismo límite.
  @Public()
  @UseGuards(ThrottlerGuard)
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiResponse({ status: 200, type: LoginResponseDto })
  @ApiResponse({ status: 400, description: 'Datos inválidos' })
  @ApiResponse({
    status: 401,
    description: 'Credenciales inválidas o cliente dado de baja',
  })
  @ApiResponse({
    status: 429,
    description: 'Demasiados intentos de login desde esta IP (5 por minuto)',
  })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiResponse({ status: 200, type: PerfilResponseDto })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  me(@CurrentUser() user: UsuarioAutenticado) {
    return this.authService.perfil(user);
  }
}
