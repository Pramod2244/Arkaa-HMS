import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../app/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  try {
    const stores = await prisma.store.findMany({ take: 1 });
    console.log("Store query OK. Count:", stores.length);
    console.log("Data:", JSON.stringify(stores, null, 2));
  } catch (e: any) {
    console.error("ERROR:", e.message);
    if (e.code) console.error("Code:", e.code);
  } finally {
    await prisma.$disconnect();
  }
}
main();
