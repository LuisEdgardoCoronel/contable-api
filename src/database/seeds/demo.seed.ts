import { hash } from 'bcryptjs';
import { DataSource, EntityManager, In } from 'typeorm';
import { Cliente, CondicionIVA } from '../../clientes/cliente.entity';
import { hoyArgentina, sumarDias, sumarMeses } from '../../common/utils/fecha';
import { esCuitValido } from '../../common/validators/is-cuit.validator';
import { CodigoImpuesto, Impuesto } from '../../impuestos/impuesto.entity';
import { Rol, Usuario } from '../../usuarios/usuario.entity';
import { BCRYPT_ROUNDS } from '../../usuarios/usuarios.service';
import {
  EstadoVencimiento,
  Vencimiento,
} from '../../vencimientos/vencimiento.entity';
import { seedImpuestos } from './impuestos.seed';

/** Credenciales de demo (documentadas en el README). Solo para desarrollo local. */
export const DEMO_ADMIN = {
  email: 'demo@example.com',
  password: 'demo1234',
  nombre: 'Estudio Demo',
};
export const DEMO_CLIENTE = {
  email: 'cliente.demo@example.com',
  password: 'demo1234',
};

interface ClienteDemo {
  razonSocial: string;
  /** 10 primeros dígitos del CUIT; el verificador se calcula. */
  cuitBase: string;
  condicionIVA: CondicionIVA;
  mensuales: CodigoImpuesto[];
  anuales?: CodigoImpuesto[];
  activo?: boolean;
  /** Si tiene usuario para loguearse (DEMO_CLIENTE). */
  conAcceso?: boolean;
}

const CLIENTES: ClienteDemo[] = [
  {
    razonSocial: 'Panadería La Espiga SRL',
    cuitBase: '3071234567',
    condicionIVA: CondicionIVA.RESPONSABLE_INSCRIPTO,
    mensuales: [CodigoImpuesto.IVA, CodigoImpuesto.IIBB],
    anuales: [CodigoImpuesto.GANANCIAS],
    conAcceso: true,
  },
  {
    razonSocial: 'Laura Martínez',
    cuitBase: '2731456789',
    condicionIVA: CondicionIVA.MONOTRIBUTISTA,
    mensuales: [CodigoImpuesto.MONOTRIBUTO, CodigoImpuesto.IIBB],
  },
  {
    razonSocial: 'Ricardo Gómez',
    cuitBase: '2028765432',
    condicionIVA: CondicionIVA.RESPONSABLE_INSCRIPTO,
    mensuales: [CodigoImpuesto.IVA, CodigoImpuesto.AUTONOMOS],
    anuales: [CodigoImpuesto.GANANCIAS, CodigoImpuesto.BIENES_PERSONALES],
  },
  {
    razonSocial: 'Transportes del Sur SA',
    cuitBase: '3070987654',
    condicionIVA: CondicionIVA.RESPONSABLE_INSCRIPTO,
    mensuales: [CodigoImpuesto.IVA, CodigoImpuesto.IIBB],
    anuales: [CodigoImpuesto.GANANCIAS],
  },
  {
    razonSocial: 'Ferretería El Tornillo',
    cuitBase: '2033444555',
    condicionIVA: CondicionIVA.MONOTRIBUTISTA,
    mensuales: [CodigoImpuesto.MONOTRIBUTO],
    activo: false,
  },
];

/** Meses relativos a hoy con vencimientos mensuales: de -5 (pasados) a +1. */
const MESES_DESDE = -5;
const MESES_HASTA = 1;

export interface ResumenDemo {
  clientes: number;
  vencimientos: number;
}

/**
 * Estudio de demo con fechas relativas a hoy (Argentina): siempre hay
 * presentados, vencidos, pendientes y próximos, y un cliente dado de baja.
 *
 * Idempotente: si el admin de demo ya existe, conserva su id (los tokens
 * siguen sirviendo) y reemplaza sus clientes, vencimientos y el usuario
 * cliente. Correrlo otra vez "mueve" los datos a la fecha de hoy.
 */
export async function seedDemo(
  dataSource: DataSource,
  hoy: string = hoyArgentina(),
): Promise<ResumenDemo> {
  await seedImpuestos(dataSource);
  const passwordHash = await hash(DEMO_ADMIN.password, BCRYPT_ROUNDS);
  const clientePasswordHash = await hash(DEMO_CLIENTE.password, BCRYPT_ROUNDS);

  return dataSource.transaction(async (m) => {
    const adminId = await prepararAdmin(m, passwordHash);
    await borrarDatosDelEstudio(m, adminId);

    if (await m.existsBy(Usuario, { email: DEMO_CLIENTE.email })) {
      throw new Error(
        `${DEMO_CLIENTE.email} ya existe y no pertenece al estudio demo`,
      );
    }

    const impuestos = new Map(
      (await m.find(Impuesto)).map((i) => [i.codigo, i.id]),
    );
    const vencimientos: Partial<Vencimiento>[] = [];

    for (const [ci, datos] of CLIENTES.entries()) {
      let usuarioId: string | null = null;
      if (datos.conAcceso) {
        const usuario = await m.save(
          m.create(Usuario, {
            email: DEMO_CLIENTE.email,
            password: clientePasswordHash,
            rol: Rol.CLIENTE,
            nombre: datos.razonSocial,
          }),
        );
        usuarioId = usuario.id;
      }

      const cliente = await m.save(
        m.create(Cliente, {
          razonSocial: datos.razonSocial,
          cuit: completarCuit(datos.cuitBase),
          email: `contacto${ci + 1}@example.com`,
          telefono: ci % 2 === 0 ? `11 4${ci}00-12${ci}4` : null,
          condicionIVA: datos.condicionIVA,
          activo: datos.activo ?? true,
          adminId,
          usuarioId,
        }),
      );

      for (const [j, codigo] of datos.mensuales.entries()) {
        for (let k = MESES_DESDE; k <= MESES_HASTA; k++) {
          // Día 10 a 24: existe en todos los meses.
          const fecha = diaDelMes(sumarMeses(hoy, k), 10 + ci * 3 + j);
          vencimientos.push({
            clienteId: cliente.id,
            impuestoId: impuestos.get(codigo),
            fechaVencimiento: fecha,
            // Se vence el mes siguiente al período.
            periodo: sumarMeses(fecha, -1).slice(0, 7),
            ...estadoSegunFecha(fecha, hoy, ci + j + k),
          });
        }
      }

      for (const [j, codigo] of (datos.anuales ?? []).entries()) {
        const fecha = diaDelMes(sumarMeses(hoy, -4), 15 + ci + j);
        vencimientos.push({
          clienteId: cliente.id,
          impuestoId: impuestos.get(codigo),
          fechaVencimiento: fecha,
          periodo: String(Number(fecha.slice(0, 4)) - 1),
          estado: EstadoVencimiento.PRESENTADO,
          fechaPresentacion: sumarDias(fecha, -3),
          notas: 'Declaración jurada anual',
        });
      }
    }

    await m.insert(Vencimiento, vencimientos);
    return { clientes: CLIENTES.length, vencimientos: vencimientos.length };
  });
}

/** Crea el admin de demo o, si ya existe, le restablece la contraseña. */
async function prepararAdmin(
  m: EntityManager,
  passwordHash: string,
): Promise<string> {
  const existente = await m.findOneBy(Usuario, { email: DEMO_ADMIN.email });
  if (existente) {
    if (existente.rol !== Rol.ADMIN) {
      throw new Error(`${DEMO_ADMIN.email} existe y no es admin`);
    }
    await m.update(Usuario, existente.id, {
      password: passwordHash,
      nombre: DEMO_ADMIN.nombre,
    });
    return existente.id;
  }
  const admin = await m.save(
    m.create(Usuario, {
      email: DEMO_ADMIN.email,
      password: passwordHash,
      rol: Rol.ADMIN,
      nombre: DEMO_ADMIN.nombre,
    }),
  );
  return admin.id;
}

async function borrarDatosDelEstudio(
  m: EntityManager,
  adminId: string,
): Promise<void> {
  const clientes = await m.findBy(Cliente, { adminId });
  if (clientes.length === 0) {
    return;
  }
  const usuariosCliente = clientes
    .map((c) => c.usuarioId)
    .filter((id): id is string => id !== null);

  await m.delete(Vencimiento, { clienteId: In(clientes.map((c) => c.id)) });
  await m.delete(Cliente, { adminId });
  if (usuariosCliente.length > 0) {
    await m.delete(Usuario, { id: In(usuariosCliente) });
  }
}

/**
 * Pasados: casi todos presentados, y algunos de los dos últimos meses quedan
 * pendientes (vencidos). Hoy o futuros: pendientes.
 */
function estadoSegunFecha(
  fecha: string,
  hoy: string,
  semilla: number,
): Pick<Vencimiento, 'estado' | 'fechaPresentacion' | 'notas'> {
  if (fecha >= hoy) {
    return {
      estado: EstadoVencimiento.PENDIENTE,
      fechaPresentacion: null,
      notas: null,
    };
  }
  const reciente = fecha >= sumarMeses(hoy, -2);
  if (reciente && semilla % 3 === 0) {
    return {
      estado: EstadoVencimiento.PENDIENTE,
      fechaPresentacion: null,
      notas: 'Falta documentación del cliente',
    };
  }
  return {
    estado: EstadoVencimiento.PRESENTADO,
    fechaPresentacion: sumarDias(fecha, -(1 + (semilla % 3))),
    notas: null,
  };
}

function diaDelMes(primerDia: string, dia: number): string {
  return `${primerDia.slice(0, 7)}-${String(dia).padStart(2, '0')}`;
}

/** Agrega el dígito verificador a los 10 primeros dígitos de un CUIT. */
function completarCuit(base: string): string {
  for (let d = 0; d <= 9; d++) {
    if (esCuitValido(`${base}${d}`)) {
      return `${base}${d}`;
    }
  }
  throw new Error(`El CUIT ${base}X no tiene verificador válido`);
}
