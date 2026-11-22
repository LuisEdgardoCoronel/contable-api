import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { Cliente } from '../clientes/cliente.entity';
import type { UsuarioAutenticado } from '../common/decorators/current-user.decorator';
import { esViolacionUnica } from '../common/utils/db-errors';
import { hoyArgentina } from '../common/utils/fecha';
import {
  PaginacionQueryDto,
  Paginado,
  skipTake,
} from '../common/utils/paginacion';
import { Impuesto, Periodicidad } from '../impuestos/impuesto.entity';
import { ImpuestosService } from '../impuestos/impuestos.service';
import { Rol } from '../usuarios/usuario.entity';
import {
  CONDICION_ESTADO,
  CONDICION_PROXIMO,
  parametrosEstado,
} from './condiciones';
import { ActualizarVencimientoDto } from './dto/actualizar-vencimiento.dto';
import { CrearVencimientoDto } from './dto/crear-vencimiento.dto';
import { ListarVencimientosQueryDto } from './dto/listar-vencimientos-query.dto';
import {
  EstadoActual,
  EstadoVencimiento,
  Vencimiento,
} from './vencimiento.entity';

const UQ_CLIENTE_IMPUESTO_PERIODO = 'uq_vencimientos_cliente_impuesto_periodo';

const FORMATO_PERIODO: Record<Periodicidad, RegExp> = {
  [Periodicidad.MENSUAL]: /^\d{4}-(0[1-9]|1[0-2])$/,
  [Periodicidad.ANUAL]: /^\d{4}$/,
};

export type VencimientoConEstado = Vencimiento & { estadoActual: EstadoActual };

/**
 * El acceso se resuelve siempre en SQL (ver `consultaVisible`): un admin solo
 * ve vencimientos de clientes suyos y un usuario cliente solo los propios.
 * Lo que no es visible se comporta como inexistente (404).
 */
@Injectable()
export class VencimientosService {
  constructor(
    @InjectRepository(Vencimiento)
    private readonly vencimientos: Repository<Vencimiento>,
    @InjectRepository(Cliente)
    private readonly clientes: Repository<Cliente>,
    private readonly impuestosService: ImpuestosService,
  ) {}

  async listar(
    user: UsuarioAutenticado,
    query: ListarVencimientosQueryDto,
  ): Promise<Paginado<VencimientoConEstado>> {
    if (query.desde && query.hasta && query.desde > query.hasta) {
      throw new BadRequestException('desde no puede ser posterior a hasta');
    }

    const hoy = hoyArgentina();
    const qb = this.consultaVisible(user);

    if (query.estado) {
      qb.andWhere(CONDICION_ESTADO[query.estado], parametrosEstado(hoy));
    }

    // Para un usuario cliente se suma al filtro por su propio clienteId:
    // pedir el de otro cliente simplemente no devuelve nada.
    if (query.clienteId) {
      qb.andWhere('v.clienteId = :filtroClienteId', {
        filtroClienteId: query.clienteId,
      });
    }
    if (query.impuestoId) {
      qb.andWhere('v.impuestoId = :impuestoId', {
        impuestoId: query.impuestoId,
      });
    }
    if (query.desde) {
      qb.andWhere('v.fechaVencimiento >= :desde', { desde: query.desde });
    }
    if (query.hasta) {
      qb.andWhere('v.fechaVencimiento <= :hasta', { hasta: query.hasta });
    }

    return this.paginar(qb, query, hoy);
  }

  /**
   * Pendientes que vencen entre hoy y hoy + 30 días (inclusive), por fecha.
   * Excluye los de clientes dados de baja.
   */
  async proximos(
    user: UsuarioAutenticado,
    query: PaginacionQueryDto,
  ): Promise<Paginado<VencimientoConEstado>> {
    const hoy = hoyArgentina();
    const qb = this.consultaVisible(user).andWhere(
      CONDICION_PROXIMO,
      parametrosEstado(hoy),
    );
    return this.paginar(qb, query, hoy);
  }

  async obtener(
    user: UsuarioAutenticado,
    id: string,
  ): Promise<VencimientoConEstado> {
    const vencimiento = await this.consultaVisible(user)
      .andWhere('v.id = :id', { id })
      .getOne();
    if (!vencimiento) {
      throw new NotFoundException('Vencimiento no encontrado');
    }
    return conEstadoActual(vencimiento, hoyArgentina());
  }

  async crear(
    user: UsuarioAutenticado,
    dto: CrearVencimientoDto,
  ): Promise<VencimientoConEstado> {
    const cliente = await this.clientes.findOneBy({
      id: dto.clienteId,
      adminId: user.id,
    });
    if (!cliente) {
      throw new NotFoundException('Cliente no encontrado');
    }
    if (!cliente.activo) {
      throw new ConflictException('El cliente está dado de baja');
    }

    const impuesto = await this.impuestosService.buscar(dto.impuestoId);
    if (!impuesto) {
      throw new NotFoundException('Impuesto no encontrado');
    }
    validarPeriodo(impuesto, dto.periodo);

    const clave = {
      clienteId: cliente.id,
      impuestoId: impuesto.id,
      periodo: dto.periodo,
    };
    if (await this.vencimientos.existsBy(clave)) {
      throw vencimientoDuplicado();
    }

    let creado: Vencimiento;
    try {
      creado = await this.vencimientos.save(
        this.vencimientos.create({
          ...clave,
          fechaVencimiento: dto.fechaVencimiento,
          notas: dto.notas ?? null,
        }),
      );
    } catch (error) {
      // Carrera entre el chequeo y el insert: lo resuelve el índice único.
      if (esViolacionUnica(error, UQ_CLIENTE_IMPUESTO_PERIODO)) {
        throw vencimientoDuplicado();
      }
      throw error;
    }
    return this.obtener(user, creado.id);
  }

  async actualizar(
    user: UsuarioAutenticado,
    id: string,
    dto: ActualizarVencimientoDto,
  ): Promise<VencimientoConEstado> {
    const actual = await this.obtener(user, id);
    const hoy = hoyArgentina();
    const estado = dto.estado ?? actual.estado;
    const cambios: Partial<Vencimiento> = { estado };

    if (estado === EstadoVencimiento.PRESENTADO) {
      if (dto.fechaPresentacion && dto.fechaPresentacion > hoy) {
        throw new BadRequestException(
          'fechaPresentacion no puede ser posterior a hoy',
        );
      }
      // Si ya estaba presentado y no se manda fecha, se conserva la anterior.
      cambios.fechaPresentacion =
        dto.fechaPresentacion ?? actual.fechaPresentacion ?? hoy;
    } else {
      if (dto.fechaPresentacion) {
        throw new BadRequestException(
          'fechaPresentacion solo se admite si el vencimiento queda presentado',
        );
      }
      cambios.fechaPresentacion = null;
    }

    if (dto.notas !== undefined) {
      cambios.notas = dto.notas;
    }

    // No toca fechaPresentacion; estadoActual se recalcula al leerlo.
    if (dto.fechaVencimiento !== undefined) {
      cambios.fechaVencimiento = dto.fechaVencimiento;
    }

    await this.vencimientos.update({ id: actual.id }, cambios);
    return this.obtener(user, id);
  }

  async eliminar(user: UsuarioAutenticado, id: string): Promise<void> {
    const vencimiento = await this.obtener(user, id);
    await this.vencimientos.delete({ id: vencimiento.id });
  }

  /**
   * Vencimientos visibles para el usuario (`v`, con el cliente unido como `c`),
   * sin columnas seleccionadas: quien la usa elige el `select`. Es la única
   * fuente del filtro de acceso; también la usan las estadísticas para agregar.
   */
  consultaAcceso(user: UsuarioAutenticado): SelectQueryBuilder<Vencimiento> {
    const qb = this.vencimientos
      .createQueryBuilder('v')
      .select([])
      .innerJoin('v.cliente', 'c');

    if (user.rol === Rol.ADMIN) {
      return qb.where('c.adminId = :adminId', { adminId: user.id });
    }
    if (!user.clienteId) {
      // JwtStrategy no deja pasar a un cliente sin Cliente; por las dudas, nada visible.
      return qb.where('1 = 0');
    }
    return qb.where('v.clienteId = :clienteId', { clienteId: user.clienteId });
  }

  /** `consultaAcceso` más los datos que se devuelven: vencimiento, impuesto y cliente reducido. */
  private consultaVisible(
    user: UsuarioAutenticado,
  ): SelectQueryBuilder<Vencimiento> {
    return this.consultaAcceso(user)
      .addSelect('v')
      .addSelect(['c.id', 'c.razonSocial', 'c.cuit'])
      .innerJoinAndSelect('v.impuesto', 'i');
  }

  private async paginar(
    qb: SelectQueryBuilder<Vencimiento>,
    query: PaginacionQueryDto,
    hoy: string,
  ): Promise<Paginado<VencimientoConEstado>> {
    const { skip, take } = skipTake(query);
    const [filas, total] = await qb
      .orderBy('v.fechaVencimiento', 'ASC')
      .addOrderBy('v.id', 'ASC')
      .skip(skip)
      .take(take)
      .getManyAndCount();

    return {
      data: filas.map((v) => conEstadoActual(v, hoy)),
      total,
      page: query.page,
      limit: query.limit,
    };
  }
}

/** Misma regla que el filtro SQL: pendiente con fecha anterior a hoy → vencido. */
export function calcularEstadoActual(
  v: Pick<Vencimiento, 'estado' | 'fechaVencimiento'>,
  hoy: string,
): EstadoActual {
  if (v.estado === EstadoVencimiento.PRESENTADO) {
    return EstadoActual.PRESENTADO;
  }
  return v.fechaVencimiento < hoy
    ? EstadoActual.VENCIDO
    : EstadoActual.PENDIENTE;
}

function conEstadoActual(v: Vencimiento, hoy: string): VencimientoConEstado {
  return Object.assign(v, { estadoActual: calcularEstadoActual(v, hoy) });
}

function validarPeriodo(impuesto: Impuesto, periodo: string): void {
  if (!FORMATO_PERIODO[impuesto.periodicidad].test(periodo)) {
    const formato =
      impuesto.periodicidad === Periodicidad.MENSUAL ? 'YYYY-MM' : 'YYYY';
    throw new BadRequestException(
      `periodo debe tener formato ${formato} para ${impuesto.nombre} (${impuesto.periodicidad})`,
    );
  }
}

function vencimientoDuplicado() {
  return new ConflictException(
    'Ya existe un vencimiento de ese impuesto para ese cliente y período',
  );
}
