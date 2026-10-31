import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { Cliente } from '../clientes/cliente.entity';
import { Impuesto } from '../impuestos/impuesto.entity';

/** Estados persistidos. `vencido` se calcula, no se guarda. */
export enum EstadoVencimiento {
  PENDIENTE = 'pendiente',
  PRESENTADO = 'presentado',
}

/** Estado que expone la API: agrega `vencido` (pendiente con fecha anterior a hoy). */
export enum EstadoActual {
  PENDIENTE = 'pendiente',
  PRESENTADO = 'presentado',
  VENCIDO = 'vencido',
}

@Entity('vencimientos')
@Unique('uq_vencimientos_cliente_impuesto_periodo', [
  'clienteId',
  'impuestoId',
  'periodo',
])
export class Vencimiento {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  clienteId!: string;

  @ManyToOne(() => Cliente, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'cliente_id' })
  cliente!: Cliente;

  @Column({ type: 'uuid' })
  impuestoId!: string;

  @ManyToOne(() => Impuesto, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'impuesto_id' })
  impuesto!: Impuesto;

  /** `YYYY-MM-DD`, sin hora. Se maneja como string para evitar corrimientos de zona horaria. */
  @Column({ type: 'date' })
  fechaVencimiento!: string;

  /** `YYYY-MM` (mensual) o `YYYY` (anual), según `impuesto.periodicidad`. */
  @Column({ type: 'varchar', length: 7 })
  periodo!: string;

  @Column({
    type: 'enum',
    enum: EstadoVencimiento,
    enumName: 'vencimiento_estado',
    default: EstadoVencimiento.PENDIENTE,
  })
  estado!: EstadoVencimiento;

  @Column({ type: 'date', nullable: true })
  fechaPresentacion!: string | null;

  @Column({ type: 'text', nullable: true })
  notas!: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
