import { DataSource, EntityManager } from 'typeorm';
import { escaparLike } from '../../common/utils/paginacion';
import { DEMO_ADMIN, DEMO_CLIENTE } from '../seeds/demo.seed';

/** Prefijo de los admins que crean los e2e (p. ej. los de contable-dashboard). */
export const PREFIJO_E2E = 'e2e-';
export const DOMINIO_E2E = '@example.com';

/** Emails que la limpieza nunca borra, aunque coincidan con el patrón. */
export const EMAILS_PROTEGIDOS = [DEMO_ADMIN.email, DEMO_CLIENTE.email];

export interface ResumenLimpieza {
  admins: number;
  clientes: number;
  usuariosCliente: number;
  vencimientos: number;
}

/**
 * Borra, en una transacción, los admins cuyo email empieza con `prefijo` y
 * termina en `@example.com`, con sus clientes, los usuarios cliente vinculados
 * y los vencimientos de esos clientes. Nunca toca `EMAILS_PROTEGIDOS`.
 *
 * `prefijo` existe para que el e2e de este script borre solo lo suyo; tiene que
 * empezar con `e2e-`.
 */
export async function limpiarE2e(
  dataSource: DataSource,
  prefijo: string = PREFIJO_E2E,
): Promise<ResumenLimpieza> {
  if (!prefijo.startsWith(PREFIJO_E2E)) {
    throw new Error(`El prefijo tiene que empezar con "${PREFIJO_E2E}"`);
  }
  const patron = `${escaparLike(prefijo.toLowerCase())}%${escaparLike(DOMINIO_E2E)}`;

  return dataSource.transaction(async (m) => {
    const admins: { id: string }[] = await m.query(
      `SELECT id FROM usuarios
        WHERE rol = 'admin' AND email LIKE $1 AND email <> ALL($2)
        FOR UPDATE`,
      [patron, EMAILS_PROTEGIDOS],
    );
    const adminIds = admins.map((a) => a.id);
    if (adminIds.length === 0) {
      return { admins: 0, clientes: 0, usuariosCliente: 0, vencimientos: 0 };
    }

    const vencimientos = await contar(
      m,
      `DELETE FROM vencimientos WHERE cliente_id IN
         (SELECT id FROM clientes WHERE admin_id = ANY($1))
       RETURNING id`,
      [adminIds],
    );

    const clientes: { usuario_id: string | null }[] = await m.query(
      `WITH borrados AS (
         DELETE FROM clientes WHERE admin_id = ANY($1) RETURNING usuario_id
       )
       SELECT usuario_id FROM borrados`,
      [adminIds],
    );
    const usuariosClienteIds = clientes
      .map((c) => c.usuario_id)
      .filter((id): id is string => id !== null);

    const usuariosCliente = await contar(
      m,
      `DELETE FROM usuarios
        WHERE id = ANY($1) AND rol = 'cliente' AND email <> ALL($2)
        RETURNING id`,
      [usuariosClienteIds, EMAILS_PROTEGIDOS],
    );

    const adminsBorrados = await contar(
      m,
      `DELETE FROM usuarios WHERE id = ANY($1) RETURNING id`,
      [adminIds],
    );

    return {
      admins: adminsBorrados,
      clientes: clientes.length,
      usuariosCliente,
      vencimientos,
    };
  });
}

/** Corre un `DELETE ... RETURNING` y devuelve cuántas filas borró. */
async function contar(
  m: EntityManager,
  deleteReturning: string,
  parametros: unknown[],
): Promise<number> {
  const [{ total }]: { total: number }[] = await m.query(
    `WITH borrados AS (${deleteReturning}) SELECT count(*)::int AS total FROM borrados`,
    parametros,
  );
  return total;
}
