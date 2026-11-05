import { sumarDias } from '../common/utils/fecha';
import { EstadoActual, EstadoVencimiento } from './vencimiento.entity';

/**
 * Condiciones SQL de cada estado actual, compartidas por el listado, `/proximos`
 * y las estadísticas para que los números coincidan siempre. Usan el alias `v`
 * (vencimiento) y `c` (cliente) y los parámetros de `parametrosEstado(hoy)`.
 */
export const CONDICION_ESTADO: Record<EstadoActual, string> = {
  [EstadoActual.PENDIENTE]:
    'v.estado = :estadoPendiente AND v.fechaVencimiento >= :hoy',
  [EstadoActual.VENCIDO]:
    'v.estado = :estadoPendiente AND v.fechaVencimiento < :hoy',
  [EstadoActual.PRESENTADO]: 'v.estado = :estadoPresentado',
};

export const DIAS_PROXIMOS = 30;

/** No presentados entre hoy y hoy + 30 (inclusive), de clientes activos. */
export const CONDICION_PROXIMO =
  'v.estado = :estadoPendiente AND v.fechaVencimiento BETWEEN :hoy AND :limiteProximos AND c.activo = true';

/** Parámetros de las condiciones de arriba. `hoy` siempre de `hoyArgentina()`. */
export function parametrosEstado(hoy: string): Record<string, string> {
  return {
    estadoPendiente: EstadoVencimiento.PENDIENTE,
    estadoPresentado: EstadoVencimiento.PRESENTADO,
    hoy,
    limiteProximos: sumarDias(hoy, DIAS_PROXIMOS),
  };
}
