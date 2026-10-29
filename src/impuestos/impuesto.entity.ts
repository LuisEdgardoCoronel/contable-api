import { Column, Entity, PrimaryGeneratedColumn, Unique } from 'typeorm';

export enum Periodicidad {
  MENSUAL = 'mensual',
  ANUAL = 'anual',
}

/** Códigos estables para referenciar impuestos desde el código. */
export enum CodigoImpuesto {
  IVA = 'IVA',
  GANANCIAS = 'GANANCIAS',
  IIBB = 'IIBB',
  AUTONOMOS = 'AUTONOMOS',
  BIENES_PERSONALES = 'BIENES_PERSONALES',
  MONOTRIBUTO = 'MONOTRIBUTO',
}

@Entity('impuestos')
@Unique('uq_impuestos_codigo', ['codigo'])
export class Impuesto {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar' })
  codigo!: string;

  @Column({ type: 'varchar' })
  nombre!: string;

  @Column({
    type: 'enum',
    enum: Periodicidad,
    enumName: 'impuesto_periodicidad',
  })
  periodicidad!: Periodicidad;
}
