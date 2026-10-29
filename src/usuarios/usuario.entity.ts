import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';

export enum Rol {
  ADMIN = 'admin',
  CLIENTE = 'cliente',
}

const minusculas = {
  to: (value?: string | null) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  from: (value: string) => value,
};

@Entity('usuarios')
@Unique('uq_usuarios_email', ['email'])
export class Usuario {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', transformer: minusculas })
  email!: string;

  @Column({ type: 'varchar', select: false })
  password!: string;

  @Column({ type: 'enum', enum: Rol, enumName: 'usuario_rol' })
  rol!: Rol;

  @Column({ type: 'varchar' })
  nombre!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
