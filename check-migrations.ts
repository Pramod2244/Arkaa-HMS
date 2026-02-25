import { PrismaClient } from './app/generated/prisma/client';
import { PrismaPg } from "@prisma/adapter-pg";
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

async function main() {
  const connectionString = process.env.DATABASE_URL;
  const pool = new pg.Pool({ connectionString });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  try {
    const migrations: any = await prisma.$queryRaw`SELECT migration_name, applied_steps_count FROM _prisma_migrations`;
    console.log('Applied migrations:', migrations);

  } catch (error) {
    console.error('Error occurred:', error);
  } finally {
    await pool.end();
  }
}

main();
