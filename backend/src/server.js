import app from './app.js';
import { env, validateEnvironment } from './config/env.js';
import { prisma } from './lib/prisma.js';

validateEnvironment();

const server = app.listen(env.port, () => {
  console.log(`IndustrialFlow API listening on http://localhost:${env.port}`);
});

async function shutdown(signal) {
  console.log(`${signal} received; closing API`);
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

