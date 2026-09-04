import { transaction, closeDatabase } from './database.js';

const services = [
  { name: 'Стрижка', duration: 30, price: 250000 },
  { name: 'Борода', duration: 20, price: 150000 },
  { name: 'Стрижка + борода', duration: 45, price: 350000 },
];
const settings = [
  ['work_start', '09:00'], ['work_end', '18:00'], ['slot_step_minutes', '30'],
  ['work_days', '1,2,3,4,5'], ['timezone', 'Asia/Almaty'],
];
const masters = ['Асанали', 'Диас', 'Султан', 'Арман'];

await transaction(async (database) => {
  const serviceCount = Number((await database.one('SELECT COUNT(*) AS count FROM services'))?.count || 0);
  if (serviceCount === 0) {
    for (const service of services) {
      await database.run(
        `INSERT INTO services (name, duration_minutes, price_cents, is_active) VALUES (?, ?, ?, 1)`,
        [service.name, service.duration, service.price],
      );
    }
    console.log(`Seeded ${services.length} services.`);
  } else console.log(`Services already exist (${serviceCount}), skipping.`);

  const masterCount = Number((await database.one('SELECT COUNT(*) AS count FROM barbers'))?.count || 0);
  if (masterCount === 0) {
    for (const [index, name] of masters.entries()) {
      await database.run(
        `INSERT INTO barbers (name, photo_url, is_active, sort_order) VALUES (?, NULL, 1, ?)`,
        [name, index + 1],
      );
    }
    console.log(`Seeded ${masters.length} masters.`);
  } else console.log(`Masters already exist (${masterCount}), skipping.`);

  const settingsCount = Number((await database.one('SELECT COUNT(*) AS count FROM business_settings'))?.count || 0);
  if (settingsCount === 0) {
    for (const [key, value] of settings) {
      await database.run(`INSERT INTO business_settings (key, value) VALUES (?, ?)`, [key, value]);
    }
    console.log(`Seeded ${settings.length} business settings.`);
  } else console.log(`Business settings already exist (${settingsCount}), skipping.`);

  const assignmentCount = Number((await database.one('SELECT COUNT(*) AS count FROM service_masters'))?.count || 0);
  if (assignmentCount === 0) {
    const result = await database.run(`
      INSERT INTO service_masters (service_id, master_id)
      SELECT services.id, barbers.id FROM services CROSS JOIN barbers
      WHERE services.is_active = 1 AND barbers.is_active = 1
      ON CONFLICT (service_id, master_id) DO NOTHING
    `);
    console.log(`Seeded ${result.changes} service-master assignments.`);
  } else console.log(`Service-master assignments already exist (${assignmentCount}), skipping.`);
});

console.log('Seed complete.');
await closeDatabase();
