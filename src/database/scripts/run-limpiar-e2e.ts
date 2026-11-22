import dataSource from '../data-source';
import { DOMINIO_E2E, limpiarE2e, PREFIJO_E2E } from './limpiar-e2e';

async function run() {
  // Borra usuarios por patrón de email: nunca en producción.
  if (process.env.NODE_ENV === 'production') {
    throw new Error('limpiar:e2e no se puede correr con NODE_ENV=production');
  }

  await dataSource.initialize();
  try {
    const r = await limpiarE2e(dataSource);
    console.log(
      `Limpieza e2e OK (${PREFIJO_E2E}*${DOMINIO_E2E}): ${r.admins} admins, ` +
        `${r.clientes} clientes, ${r.usuariosCliente} usuarios cliente, ` +
        `${r.vencimientos} vencimientos borrados`,
    );
  } finally {
    await dataSource.destroy();
  }
}

run().catch((err) => {
  console.error('Limpieza e2e falló:', err);
  process.exit(1);
});
