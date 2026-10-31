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

/** true si es una fecha `YYYY-MM-DD` que existe en el calendario (rechaza 2026-02-30). */
export function esFechaValida(valor: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) {
    return false;
  }
  const d = new Date(`${valor}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === valor;
}
