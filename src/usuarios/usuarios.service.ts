import { ConflictException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { hash } from 'bcryptjs';
import { EntityManager, Repository } from 'typeorm';
import { esViolacionUnica } from '../common/utils/db-errors';
import { Rol, Usuario } from './usuario.entity';

export const BCRYPT_ROUNDS = 10;

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
   *
   * Con `manager`, el insert corre dentro de esa transacción.
   */
  async crear(
    input: CrearUsuarioInput,
    manager?: EntityManager,
  ): Promise<Usuario> {
    const usuarios = manager?.getRepository(Usuario) ?? this.usuarios;
    const email = normalizarEmail(input.email);
    if (await usuarios.existsBy({ email })) {
      throw emailEnUso();
    }

    const usuario = usuarios.create({
      email,
      nombre: input.nombre,
      rol: input.rol,
      password: await hash(input.password, BCRYPT_ROUNDS),
    });

    try {
      await usuarios.save(usuario);
    } catch (error) {
      // Carrera entre el chequeo y el insert: lo resuelve el índice único.
      if (esViolacionUnica(error, 'uq_usuarios_email')) {
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
