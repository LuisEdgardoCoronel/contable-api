import { ConflictException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { hash } from 'bcryptjs';
import { QueryFailedError, Repository } from 'typeorm';
import { Rol, Usuario } from './usuario.entity';

export const BCRYPT_ROUNDS = 10;
const PG_UNIQUE_VIOLATION = '23505';

export interface CrearUsuarioInput {
  email: string;
  password: string;
  nombre: string;
  rol: Rol;
}

@Injectable()
export class UsuariosService {
  constructor(
    @InjectRepository(Usuario)
    private readonly usuarios: Repository<Usuario>,
  ) {}

  findById(id: string): Promise<Usuario | null> {
    return this.usuarios.findOneBy({ id });
  }

  /** Incluye el hash de la contraseña. Usar solo para el login. */
  findByEmailConPassword(email: string): Promise<Usuario | null> {
    return this.usuarios
      .createQueryBuilder('u')
      .addSelect('u.password')
      .where('u.email = :email', { email: normalizarEmail(email) })
      .getOne();
  }

  /**
   * Crea un usuario con la contraseña hasheada. Lanza 409 si el email ya
   * existe. El resultado no incluye `password`.
   */
  async crear(input: CrearUsuarioInput): Promise<Usuario> {
    const email = normalizarEmail(input.email);
    if (await this.usuarios.existsBy({ email })) {
      throw emailEnUso();
    }

    const usuario = this.usuarios.create({
      email,
      nombre: input.nombre,
      rol: input.rol,
      password: await hash(input.password, BCRYPT_ROUNDS),
    });

    try {
      await this.usuarios.save(usuario);
    } catch (error) {
      // Carrera entre el chequeo y el insert: lo resuelve el índice único.
      if (
        error instanceof QueryFailedError &&
        (error.driverError as { code?: string }).code === PG_UNIQUE_VIOLATION
      ) {
        throw emailEnUso();
      }
      throw error;
    }

    // Nunca devolver el hash, aunque esté en memoria tras el insert.
    delete (usuario as Partial<Usuario>).password;
    return usuario;
  }
}

export function normalizarEmail(email: string): string {
  return email.trim().toLowerCase();
}

function emailEnUso() {
  return new ConflictException('El email ya está registrado');
}
