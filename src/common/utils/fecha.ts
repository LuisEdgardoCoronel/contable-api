export const ZONA_ARGENTINA = 'America/Argentina/Buenos_Aires';

// `en-CA` formatea como YYYY-MM-DD.
const formatoArgentina = new Intl.DateTimeFormat('en-CA', {
  timeZone: ZONA_ARGENTINA,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/**
 * Fecha de hoy (`YYYY-MM-DD`) en Argentina, sin importar la zona horaria del
 * servidor. Recibe `ahora` para poder testearla.
 */
export function hoyArgentina(ahora: Date = new Date()): string {
  return formatoArgentina.format(ahora);
}

/** Suma (o resta) días a una fecha `YYYY-MM-DD`. Opera en UTC: sin corrimientos. */
export function sumarDias(fecha: string, dias: number): string {
  const d = new Date(`${fecha}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

/** Primer día del mes de una fecha `YYYY-MM-DD`. */
export function inicioDeMes(fecha: string): string {
  return `${fecha.slice(0, 7)}-01`;
}

/** Último día del mes de una fecha `YYYY-MM-DD`. */
export function finDeMes(fecha: string): string {
  const [anio, mes] = fecha.split('-').map(Number);
  // Día 0 del mes siguiente = último día de este mes.
  return new Date(Date.UTC(anio, mes, 0)).toISOString().slice(0, 10);
}

/** Primer día del mes que está `meses` meses antes o después del de `fecha`. */
export function sumarMeses(fecha: string, meses: number): string {
  const [anio, mes] = fecha.split('-').map(Number);
  return new Date(Date.UTC(anio, mes - 1 + meses, 1))
    .toISOString()
    .slice(0, 10);
}

/** Meses (`YYYY-MM`) entre dos fechas `YYYY-MM-DD`, ambos inclusive. */
export function mesesEntre(desde: string, hasta: string): string[] {
  const meses: string[] = [];
  const ultimo = hasta.slice(0, 7);
  for (let m = inicioDeMes(desde); m.slice(0, 7) <= ultimo;) {
    meses.push(m.slice(0, 7));
    m = sumarMeses(m, 1);
  }
  return meses;
}

/** true si es una fecha `YYYY-MM-DD` que existe en el calendario (rechaza 2026-02-30). */
export function esFechaValida(valor: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) {
    return false;
  }
  const d = new Date(`${valor}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === valor;
}
