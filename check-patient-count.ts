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
    const count: any = await prisma.$queryRaw`SELECT COUNT(*) FROM "Patient"`;
    console.log('Patient count:', count);

  } catch (error) {
    console.error('Error occurred:', error);
  } finally {
    await pool.end();
  }
}

main();
