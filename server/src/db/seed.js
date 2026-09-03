import { db } from './connection.js';

const services = [
  {
    name: 'Стрижка',
    duration_minutes: 30,
    price_cents: 250000,
  },
  {
    name: 'Борода',
    duration_minutes: 20,
    price_cents: 150000,
  },
  {
    name: 'Стрижка + борода',
    duration_minutes: 45,
    price_cents: 350000,
  },
];

const settings = [
  { key: 'work_start', value: '09:00' },
  { key: 'work_end', value: '18:00' },
  { key: 'slot_step_minutes', value: '30' },
  { key: 'work_days', value: '1,2,3,4,5' },
  { key: 'timezone', value: 'Asia/Almaty' },
];

const barbers = [
  { name: 'Асанали', photo_url: null, sort_order: 1 },
  { name: 'Диас', photo_url: null, sort_order: 2 },
  { name: 'Султан', photo_url: null, sort_order: 3 },
  { name: 'Арман', photo_url: null, sort_order: 4 },
];

const insertService = db.prepare(`
  INSERT INTO services (name, duration_minutes, price_cents, is_active)
  VALUES (@name, @duration_minutes, @price_cents, 1)
`);

const insertBarber = db.prepare(`
  INSERT INTO barbers (name, photo_url, is_active, sort_order)
  VALUES (@name, @photo_url, 1, @sort_order)
`);

const insertSetting = db.prepare(`
  INSERT INTO business_settings (key, value)
  VALUES (@key, @value)
`);

const seed = db.transaction(() => {
  const serviceCount = db.prepare('SELECT COUNT(*) AS count FROM services').get().count;
  if (serviceCount === 0) {
    for (const service of services) {
      insertService.run(service);
    }
    console.log(`Seeded ${services.length} services.`);
  } else {
    console.log(`Services already exist (${serviceCount}), skipping.`);
  }

  const barberCount = db.prepare('SELECT COUNT(*) AS count FROM barbers').get().count;
  if (barberCount === 0) {
    for (const barber of barbers) {
      insertBarber.run(barber);
    }
    console.log(`Seeded ${barbers.length} barbers.`);
  } else {
    console.log(`Barbers already exist (${barberCount}), skipping.`);
  }

  const settingsCount = db.prepare('SELECT COUNT(*) AS count FROM business_settings').get().count;
  if (settingsCount === 0) {
    for (const setting of settings) {
      insertSetting.run(setting);
    }
    console.log(`Seeded ${settings.length} business settings.`);
  } else {
    console.log(`Business settings already exist (${settingsCount}), skipping.`);
  }

  // Migration 012 may run before a fresh database has been seeded. In that
  // case its compatibility INSERT has no rows to connect, leaving the public
  // catalog without any masters and making a clean CI/deployment differ from
  // an upgraded local database.
  const serviceMasterCount = db.prepare('SELECT COUNT(*) AS count FROM service_masters').get().count;
  if (serviceMasterCount === 0) {
    const result = db.prepare(`
      INSERT OR IGNORE INTO service_masters (service_id, master_id)
      SELECT services.id, barbers.id
      FROM services
      CROSS JOIN barbers
      WHERE services.is_active = 1 AND barbers.is_active = 1
    `).run();
    console.log(`Seeded ${result.changes} service-master assignments.`);
  } else {
    console.log(`Service-master assignments already exist (${serviceMasterCount}), skipping.`);
  }
});

seed();

console.log('Seed complete.');
