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
    const tables: any = await prisma.$queryRaw`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`;
    console.log('Tables in DB:', tables.map((t: any) => t.table_name));

    const patientCols: any = await prisma.$queryRaw`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'Patient'`;
    console.log('Patient columns in DB:', patientCols.map((c: any) => `${c.column_name} (${c.data_type})`));

  } catch (error) {
    console.error('Error occurred:', error);
  } finally {
    await pool.end();
  }
}

main();
