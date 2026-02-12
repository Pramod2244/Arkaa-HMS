/**
 * HMS Medical Masters - Backfill Departments Script
 * 
 * One-time script to seed predefined departments for all existing tenants.
 * 
 * Usage: npx tsx scripts/backfill-departments.ts
 */

import "dotenv/config";
import { backfillDepartmentsForAllTenants } from "../lib/services/masters/department-seed";
import { prisma } from "../lib/prisma";

async function main() {
  console.log("====================================================");
  console.log("HMS Medical Masters - Department Backfill Script");
  console.log("====================================================");
  console.log("");

  try {
    // Run the backfill
    const results = await backfillDepartmentsForAllTenants("SYSTEM");

    // Print summary
    console.log("");
    console.log("====================================================");
    console.log("BACKFILL SUMMARY");
    console.log("====================================================");

    let totalCreated = 0;
    let totalSkipped = 0;
    let totalErrors = 0;

    results.forEach((result, tenantId) => {
      console.log(`Tenant ${tenantId}:`);
      console.log(`  - Created: ${result.created}`);
      console.log(`  - Skipped: ${result.skipped}`);
      console.log(`  - Errors: ${result.errors.length}`);
      
      if (result.errors.length > 0) {
        result.errors.forEach(err => console.log(`    ERROR: ${err}`));
      }

      totalCreated += result.created;
      totalSkipped += result.skipped;
      totalErrors += result.errors.length;
    });

    console.log("");
    console.log("----------------------------------------------------");
    console.log(`TOTALS:`);
    console.log(`  - Total Created: ${totalCreated}`);
    console.log(`  - Total Skipped: ${totalSkipped}`);
    console.log(`  - Total Errors: ${totalErrors}`);
    console.log("====================================================");
    console.log("");
    console.log("Backfill completed successfully!");

  } catch (error) {
    console.error("Backfill failed:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
