import { PrismaClient } from './app/generated/prisma/client';
import { PrismaPg } from "@prisma/adapter-pg";
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("DATABASE_URL not set");
    return;
  }

  const pool = new pg.Pool({ connectionString });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({
    adapter,
    log: ['query', 'info', 'warn', 'error'],
  });

  try {
    console.log('Testing findMany (Tenant)...');
    await prisma.tenant.findMany({
      take: 1,
    });
    console.log('findMany Tenant success');

  } catch (error) {
    console.error('Error occurred:', error);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main();
