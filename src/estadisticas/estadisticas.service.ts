import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { Cliente } from '../clientes/cliente.entity';
import type { UsuarioAutenticado } from '../common/decorators/current-user.decorator';
import {
  finDeMes,
  hoyArgentina,
  mesesEntre,
  sumarMeses,
} from '../common/utils/fecha';
import {
  CONDICION_ESTADO,
  CONDICION_PROXIMO,
  parametrosEstado,
} from '../vencimientos/condiciones';
import { EstadoActual, Vencimiento } from '../vencimientos/vencimiento.entity';
import { VencimientosService } from '../vencimientos/vencimientos.service';
import { EstadisticasQueryDto } from './dto/estadisticas-query.dto';
import {
  ConteoEstadosDto,
  ConteoImpuestoDto,
  ConteoMesDto,
  EstadisticasResponseDto,
  RangoDto,
} from './dto/estadisticas-response.dto';

/** Meses del rango por defecto (el actual y los 5 anteriores). */
export const MESES_RANGO_DEFAULT = 6;
/** Tope del rango, para que `porMes` no crezca sin límite. */
export const MESES_RANGO_MAXIMO = 36;

/** Postgres devuelve `COUNT` como string (bigint). */
type Fila = Record<string, string>;

/**
 * Todo se cuenta en SQL con `COUNT(*) FILTER (...)`, sobre la misma consulta de
 * acceso y las mismas condiciones de estado que `GET /vencimientos`, para que
 * los números coincidan con el listado.
 */
@Injectable()
export class EstadisticasService {
  constructor(
    private readonly vencimientosService: VencimientosService,
    @InjectRepository(Cliente)
    private readonly clientes: Repository<Cliente>,
  ) {}

  async obtener(
    user: UsuarioAutenticado,
    query: EstadisticasQueryDto,
  ): Promise<EstadisticasResponseDto> {
    const hoy = hoyArgentina();
    const rango = resolverRango(query, hoy);

    const [clientes, totales, porMes, porImpuesto] = await Promise.all([
      this.contarClientes(user),
      this.contarTotales(user, hoy),
      this.contarPorMes(user, hoy, rango),
      this.contarPorImpuesto(user, hoy, rango),
    ]);

    return {
      hoy,
      rango,
      clientes,
      vencimientos: totales,
      porMes,
      porImpuesto,
    };
  }

  private async contarClientes(user: UsuarioAutenticado) {
    const fila = await this.clientes
      .createQueryBuilder('c')
      .select('COUNT(*) FILTER (WHERE c.activo = true)', 'activos')
      .addSelect('COUNT(*) FILTER (WHERE c.activo = false)', 'inactivos')
      .where('c.adminId = :adminId', { adminId: user.id })
      .getRawOne<Fila>();
    return {
      activos: Number(fila?.activos ?? 0),
      inactivos: Number(fila?.inactivos ?? 0),
    };
  }

  private async contarTotales(user: UsuarioAutenticado, hoy: string) {
    const fila = await this.conConteosPorEstado(user, hoy)
      .addSelect(`COUNT(*) FILTER (WHERE ${CONDICION_PROXIMO})`, 'proximos')
      .getRawOne<Fila>();
    return {
      ...aConteos(fila),
      proximos30Dias: Number(fila?.proximos ?? 0),
    };
  }

  private async contarPorMes(
    user: UsuarioAutenticado,
    hoy: string,
    rango: RangoDto,
  ): Promise<ConteoMesDto[]> {
    const filas = await this.conConteosPorEstado(user, hoy)
      .addSelect(`to_char(v.fechaVencimiento, 'YYYY-MM')`, 'mes')
      .andWhere('v.fechaVencimiento BETWEEN :desde AND :hasta', rango)
      .groupBy('mes')
      .getRawMany<Fila>();

    // Los meses sin vencimientos no vienen de la base: se completan en cero.
    const porMes = new Map(filas.map((f) => [f.mes, aConteos(f)]));
    return mesesEntre(rango.desde, rango.hasta).map((mes) => ({
      mes,
      ...(porMes.get(mes) ?? aConteos(undefined)),
    }));
  }

  private async contarPorImpuesto(
    user: UsuarioAutenticado,
    hoy: string,
    rango: RangoDto,
  ): Promise<ConteoImpuestoDto[]> {
    const filas = await this.conConteosPorEstado(user, hoy)
      .innerJoin('v.impuesto', 'i')
      .addSelect('i.id', 'impuestoId')
      .addSelect('i.codigo', 'codigo')
      .addSelect('i.nombre', 'nombre')
      .andWhere('v.fechaVencimiento BETWEEN :desde AND :hasta', rango)
      .groupBy('i.id')
      .orderBy('i.nombre', 'ASC')
      .addOrderBy('i.id', 'ASC')
      .getRawMany<Fila>();

    return filas.map((f) => ({
      impuesto: { id: f.impuestoId, codigo: f.codigo, nombre: f.nombre },
      ...aConteos(f),
    }));
  }

  /** Consulta de acceso del usuario con los tres conteos por estado actual. */
  private conConteosPorEstado(
    user: UsuarioAutenticado,
    hoy: string,
  ): SelectQueryBuilder<Vencimiento> {
    const contar = (estado: EstadoActual) =>
      `COUNT(*) FILTER (WHERE ${CONDICION_ESTADO[estado]})`;

    return this.vencimientosService
      .consultaAcceso(user)
      .select(contar(EstadoActual.PENDIENTE), 'pendientes')
      .addSelect(contar(EstadoActual.VENCIDO), 'vencidos')
      .addSelect(contar(EstadoActual.PRESENTADO), 'presentados')
      .setParameters(parametrosEstado(hoy));
  }
}

function aConteos(fila: Fila | undefined): ConteoEstadosDto {
  return {
    pendientes: Number(fila?.pendientes ?? 0),
    vencidos: Number(fila?.vencidos ?? 0),
    presentados: Number(fila?.presentados ?? 0),
  };
}

/**
 * Sin fechas: los últimos 6 meses calendario hasta fin del mes actual. Con una
 * sola, la otra se calcula a 6 meses de esa (así `?hasta=2025-01-31` no choca
 * con un `desde` por defecto posterior).
 */
export function resolverRango(
  query: EstadisticasQueryDto,
  hoy: string,
): RangoDto {
  const atras = MESES_RANGO_DEFAULT - 1;
  const hasta =
    query.hasta ?? finDeMes(query.desde ? sumarMeses(query.desde, atras) : hoy);
  const desde = query.desde ?? sumarMeses(hasta, -atras);

  if (desde > hasta) {
    throw new BadRequestException('desde no puede ser posterior a hasta');
  }
  if (mesesEntre(desde, hasta).length > MESES_RANGO_MAXIMO) {
    throw new BadRequestException(
      `El rango no puede abarcar más de ${MESES_RANGO_MAXIMO} meses`,
    );
  }
  return { desde, hasta };
}
