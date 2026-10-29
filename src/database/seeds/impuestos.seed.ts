import { DataSource } from 'typeorm';
import {
  CodigoImpuesto,
  Impuesto,
  Periodicidad,
} from '../../impuestos/impuesto.entity';

const IMPUESTOS: Omit<Impuesto, 'id'>[] = [
  {
    codigo: CodigoImpuesto.IVA,
    nombre: 'IVA',
    periodicidad: Periodicidad.MENSUAL,
  },
  {
    codigo: CodigoImpuesto.GANANCIAS,
    nombre: 'Ganancias',
    periodicidad: Periodicidad.ANUAL,
  },
  {
    codigo: CodigoImpuesto.IIBB,
    nombre: 'Ingresos Brutos',
    periodicidad: Periodicidad.MENSUAL,
  },
  {
    codigo: CodigoImpuesto.AUTONOMOS,
    nombre: 'Autónomos',
    periodicidad: Periodicidad.MENSUAL,
  },
  {
    codigo: CodigoImpuesto.BIENES_PERSONALES,
    nombre: 'Bienes Personales',
    periodicidad: Periodicidad.ANUAL,
  },
  {
    codigo: CodigoImpuesto.MONOTRIBUTO,
    nombre: 'Monotributo',
    periodicidad: Periodicidad.MENSUAL,
  },
];

/** Idempotente: upsert por `codigo`, no duplica si se corre varias veces. */
export async function seedImpuestos(dataSource: DataSource): Promise<number> {
  await dataSource
    .getRepository(Impuesto)
    .upsert(IMPUESTOS, { conflictPaths: ['codigo'] });
  return IMPUESTOS.length;
}
