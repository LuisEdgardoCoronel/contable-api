import dataSource from '../data-source';
import { seedImpuestos } from './impuestos.seed';

async function run() {
  await dataSource.initialize();
  try {
    const n = await seedImpuestos(dataSource);
    console.log(`Seed OK: ${n} impuestos`);
  } finally {
    await dataSource.destroy();
  }
}

run().catch((err) => {
  console.error('Seed falló:', err);
  process.exit(1);
});
