import dataSource from '../data-source';
import { DEMO_ADMIN, DEMO_CLIENTE, seedDemo } from './demo.seed';

async function run() {
  // Crea usuarios con contraseñas conocidas: nunca en producción.
  if (process.env.NODE_ENV === 'production') {
    throw new Error('seed:demo no se puede correr con NODE_ENV=production');
  }

  await dataSource.initialize();
  try {
    const { clientes, vencimientos } = await seedDemo(dataSource);
    console.log(
      `Seed demo OK: ${clientes} clientes, ${vencimientos} vencimientos`,
    );
    console.log(`  Admin:   ${DEMO_ADMIN.email} / ${DEMO_ADMIN.password}`);
    console.log(`  Cliente: ${DEMO_CLIENTE.email} / ${DEMO_CLIENTE.password}`);
  } finally {
    await dataSource.destroy();
  }
}

run().catch((err) => {
  console.error('Seed demo falló:', err);
  process.exit(1);
});
