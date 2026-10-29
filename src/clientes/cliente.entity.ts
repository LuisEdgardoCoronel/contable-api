import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { Usuario } from '../usuarios/usuario.entity';

export enum CondicionIVA {
  RESPONSABLE_INSCRIPTO = 'responsable_inscripto',
  MONOTRIBUTISTA = 'monotributista',
  EXENTO = 'exento',
  CONSUMIDOR_FINAL = 'consumidor_final',
  NO_ALCANZADO = 'no_alcanzado',
}

@Entity('clientes')
@Unique('uq_clientes_admin_cuit', ['adminId', 'cuit'])
export class Cliente {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar' })
  razonSocial!: string;

  @Column({ type: 'varchar', length: 11 })
  cuit!: string;

  @Column({ type: 'varchar' })
  email!: string;

  @Column({ type: 'varchar', nullable: true })
  telefono!: string | null;

  @Column({
    type: 'enum',
    enum: CondicionIVA,
    enumName: 'cliente_condicion_iva',
  })
  condicionIVA!: CondicionIVA;

  @Column({ type: 'boolean', default: true })
  activo!: boolean;

  /** Admin dueño del estudio al que pertenece el cliente. */
  @Column({ type: 'uuid' })
  adminId!: string;

  @ManyToOne(() => Usuario, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'admin_id' })
  admin!: Usuario;

  /** Usuario con rol cliente; se completa al crear el acceso. */
  @Column({ type: 'uuid', nullable: true })
  usuarioId!: string | null;

  @OneToOne(() => Usuario, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'usuario_id' })
  usuario!: Usuario | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
