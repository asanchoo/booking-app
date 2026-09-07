// Booking timestamps are stored as salon-local wall-clock values. Set the
// process timezone before application modules evaluate so serverless runtimes
// interpret them consistently with local development.
process.env.TZ = process.env.BUSINESS_TIMEZONE || 'Asia/Almaty';
