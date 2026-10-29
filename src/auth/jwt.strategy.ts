import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { InjectRepository } from '@nestjs/typeorm';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Repository } from 'typeorm';
import { Cliente } from '../clientes/cliente.entity';
import { UsuarioAutenticado } from '../common/decorators/current-user.decorator';
import { EnvironmentVariables } from '../config/env.validation';
import { Rol } from '../usuarios/usuario.entity';
import { UsuariosService } from '../usuarios/usuarios.service';

export interface JwtPayload {
  sub: string;
  rol: Rol;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService<EnvironmentVariables, true>,
    private readonly usuariosService: UsuariosService,
    @InjectRepository(Cliente)
    private readonly clientes: Repository<Cliente>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get('JWT_SECRET', { infer: true }),
      algorithms: ['HS256'],
    });
  }

  /**
   * Se revalida contra la base en cada request: si el usuario se borró o su
   * Cliente fue dado de baja, el token deja de servir aunque no haya vencido.
   */
  async validate(payload: JwtPayload): Promise<UsuarioAutenticado> {
    const usuario = await this.usuariosService.findById(payload.sub);
    if (!usuario) {
      throw new UnauthorizedException();
    }

    let clienteId: string | null = null;
    if (usuario.rol === Rol.CLIENTE) {
      const cliente = await this.clientes.findOneBy({ usuarioId: usuario.id });
      if (!cliente || !cliente.activo) {
        throw new UnauthorizedException();
      }
      clienteId = cliente.id;
    }

    return {
      id: usuario.id,
      email: usuario.email,
      rol: usuario.rol,
      clienteId,
    };
  }
}
