import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, DataSource, Repository } from 'typeorm';
import { esViolacionUnica } from '../common/utils/db-errors';
import { escaparLike, Paginado, skipTake } from '../common/utils/paginacion';
import { Rol, Usuario } from '../usuarios/usuario.entity';
import { UsuariosService } from '../usuarios/usuarios.service';
import { Cliente } from './cliente.entity';
import { ActualizarClienteDto } from './dto/actualizar-cliente.dto';
import { CrearAccesoDto } from './dto/crear-acceso.dto';
import { CrearClienteDto } from './dto/crear-cliente.dto';
import { ListarClientesQueryDto } from './dto/listar-clientes-query.dto';

const UQ_ADMIN_CUIT = 'uq_clientes_admin_cuit';

/**
 * Todas las operaciones reciben el `adminId` del usuario logueado y filtran
 * por él: un cliente de otro estudio se comporta como inexistente (404).
 */
@Injectable()
export class ClientesService {
  constructor(
    @InjectRepository(Cliente)
    private readonly clientes: Repository<Cliente>,
    private readonly usuariosService: UsuariosService,
    private readonly dataSource: DataSource,
  ) {}

  async listar(
    adminId: string,
    query: ListarClientesQueryDto,
  ): Promise<Paginado<Cliente>> {
    const qb = this.clientes
      .createQueryBuilder('c')
      .where('c.adminId = :adminId', { adminId });

    if (query.activo !== undefined) {
      qb.andWhere('c.activo = :activo', { activo: query.activo });
    }

    if (query.search) {
      const search = query.search;
      // Si parece un CUIT (dígitos y guiones), también se busca por CUIT.
      const digitos = /^[\d\s-]+$/.test(search)
        ? search.replace(/\D/g, '')
        : '';
      qb.andWhere(
        new Brackets((w) => {
          w.where('c.razonSocial ILIKE :texto', {
            texto: `%${escaparLike(search)}%`,
          });
          if (digitos) {
            w.orWhere('c.cuit LIKE :cuit', { cuit: `%${digitos}%` });
          }
        }),
      );
    }

    const { skip, take } = skipTake(query);
    const [data, total] = await qb
      .orderBy('c.razonSocial', 'ASC')
      .addOrderBy('c.id', 'ASC')
      .skip(skip)
      .take(take)
      .getManyAndCount();

    return { data, total, page: query.page, limit: query.limit };
  }

  async obtener(adminId: string, id: string): Promise<Cliente> {
    const cliente = await this.clientes.findOneBy({ id, adminId });
    if (!cliente) {
      throw new NotFoundException('Cliente no encontrado');
    }
    return cliente;
  }

  async crear(adminId: string, dto: CrearClienteDto): Promise<Cliente> {
    await this.verificarCuitLibre(adminId, dto.cuit);
    const cliente = this.clientes.create({
      razonSocial: dto.razonSocial,
      cuit: dto.cuit,
      email: dto.email,
      telefono: dto.telefono ?? null,
      condicionIVA: dto.condicionIVA,
      adminId,
    });
    return this.guardar(cliente);
  }

  async actualizar(
    adminId: string,
    id: string,
    dto: ActualizarClienteDto,
  ): Promise<Cliente> {
    const cliente = await this.obtener(adminId, id);
    if (dto.cuit !== cliente.cuit) {
      await this.verificarCuitLibre(adminId, dto.cuit);
    }

    cliente.razonSocial = dto.razonSocial;
    cliente.cuit = dto.cuit;
    cliente.email = dto.email;
    cliente.telefono = dto.telefono ?? null;
    cliente.condicionIVA = dto.condicionIVA;
    if (dto.activo !== undefined) {
      cliente.activo = dto.activo;
    }
    return this.guardar(cliente);
  }

  /**
   * Baja lógica. El usuario cliente vinculado deja de poder loguearse y sus
   * tokens ya emitidos dejan de valer (JwtStrategy revisa `activo`).
   * Es idempotente: dar de baja un cliente ya inactivo no es error.
   */
  async darDeBaja(adminId: string, id: string): Promise<void> {
    const cliente = await this.obtener(adminId, id);
    if (cliente.activo) {
      await this.clientes.update({ id, adminId }, { activo: false });
    }
  }

  /**
   * Crea el usuario con rol cliente y lo vincula al Cliente, todo en una
   * transacción. El lock sobre la fila evita que dos requests simultáneos
   * creen dos accesos para el mismo cliente.
   */
  async crearAcceso(
    adminId: string,
    id: string,
    dto: CrearAccesoDto,
  ): Promise<Usuario> {
    return this.dataSource.transaction(async (manager) => {
      const cliente = await manager.findOne(Cliente, {
        where: { id, adminId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!cliente) {
        throw new NotFoundException('Cliente no encontrado');
      }
      if (cliente.usuarioId) {
        throw new ConflictException('El cliente ya tiene acceso');
      }
      if (!cliente.activo) {
        throw new ConflictException('El cliente está dado de baja');
      }

      const usuario = await this.usuariosService.crear(
        {
          email: dto.email,
          password: dto.password,
          nombre: dto.nombre ?? cliente.razonSocial,
          rol: Rol.CLIENTE,
        },
        manager,
      );
      await manager.update(Cliente, { id }, { usuarioId: usuario.id });
      return usuario;
    });
  }

  private async verificarCuitLibre(adminId: string, cuit: string) {
    if (await this.clientes.existsBy({ adminId, cuit })) {
      throw cuitEnUso();
    }
  }

  private async guardar(cliente: Cliente): Promise<Cliente> {
    try {
      return await this.clientes.save(cliente);
    } catch (error) {
      // Carrera entre el chequeo y el insert/update: lo resuelve el índice.
      if (esViolacionUnica(error, UQ_ADMIN_CUIT)) {
        throw cuitEnUso();
      }
      throw error;
    }
  }
}

function cuitEnUso() {
  return new ConflictException('Ya existe un cliente con ese CUIT');
}
