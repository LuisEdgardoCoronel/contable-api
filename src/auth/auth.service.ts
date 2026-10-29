import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { compare, hashSync } from 'bcryptjs';
import { Repository } from 'typeorm';
import { Cliente } from '../clientes/cliente.entity';
import { UsuarioAutenticado } from '../common/decorators/current-user.decorator';
import { Rol, Usuario } from '../usuarios/usuario.entity';
import { BCRYPT_ROUNDS, UsuariosService } from '../usuarios/usuarios.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { JwtPayload } from './jwt.strategy';

// Si el email no existe se compara igual contra este hash, para que el tiempo
// de respuesta no revele qué emails están registrados.
let hashFalso: string | undefined;
const getHashFalso = () =>
  (hashFalso ??= hashSync('password-inexistente', BCRYPT_ROUNDS));

@Injectable()
export class AuthService {
  constructor(
    private readonly usuariosService: UsuariosService,
    private readonly jwtService: JwtService,
    @InjectRepository(Cliente)
    private readonly clientes: Repository<Cliente>,
  ) {}

  /** Siempre crea un admin: el `rol` del body se ignora. */
  register(dto: RegisterDto): Promise<Usuario> {
    return this.usuariosService.crear({
      email: dto.email,
      password: dto.password,
      nombre: dto.nombre,
      rol: Rol.ADMIN,
    });
  }

  async login(dto: LoginDto): Promise<{ accessToken: string }> {
    const usuario = await this.usuariosService.findByEmailConPassword(
      dto.email,
    );
    const passwordOk = await compare(
      dto.password,
      usuario?.password ?? getHashFalso(),
    );
    if (!usuario || !passwordOk) {
      throw credencialesInvalidas();
    }

    // Un usuario cliente sin Cliente activo (dado de baja) no puede entrar.
    if (usuario.rol === Rol.CLIENTE) {
      const cliente = await this.clientes.findOneBy({ usuarioId: usuario.id });
      if (!cliente || !cliente.activo) {
        throw credencialesInvalidas();
      }
    }

    const payload: JwtPayload = { sub: usuario.id, rol: usuario.rol };
    return { accessToken: await this.jwtService.signAsync(payload) };
  }

  async perfil(
    user: UsuarioAutenticado,
  ): Promise<Usuario & { cliente: Cliente | null }> {
    const usuario = await this.usuariosService.findById(user.id);
    if (!usuario) {
      throw new UnauthorizedException();
    }
    const cliente = user.clienteId
      ? await this.clientes.findOneBy({ id: user.clienteId })
      : null;
    return { ...usuario, cliente };
  }
}

function credencialesInvalidas() {
  return new UnauthorizedException('Credenciales inválidas');
}
