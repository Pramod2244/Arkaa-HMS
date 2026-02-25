import { Worker, Job } from "bullmq";
import { prisma } from "@/lib/prisma";
import IORedis from "ioredis";

/**
 * HMS Reporting Worker
 * Autonomously handles heavy data aggregations and Materialized View refreshes.
 */

const connection = new IORedis(process.env.REDIS_URL || "redis://localhost:6379", {
  maxRetriesPerRequest: null,
});

const reportingWorker = new Worker(
  "reporting-queue",
  async (job: Job) => {
    const { type, tenantId } = job.data;

    console.log(`[ReportingWorker] Processing ${type} for tenant ${tenantId || 'GLOBAL'}`);

    switch (type) {
      case "REFRESH_REVENUE_MV":
        // Refreshes the departmental revenue materialized view
        await prisma.$executeRawUnsafe(`REFRESH MATERIALIZED VIEW CONCURRENTLY mv_dept_revenue_daily`);
        break;

      case "REFRESH_STOCK_MV":
        // Refreshes the stock status materialized view
        await prisma.$executeRawUnsafe(`REFRESH MATERIALIZED VIEW CONCURRENTLY mv_current_stock`);
        break;

      case "AGGREGATE_MONTHLY_STATS":
        // Perform heavy monthly aggregation and store in a cache or dedicated table
        // Implementation would go here...
        break;

      default:
        console.warn(`[ReportingWorker] Unknown job type: ${type}`);
    }
  },
  { connection }
);

reportingWorker.on("completed", (job) => {
  console.log(`[ReportingWorker] Job ${job.id} completed successfully.`);
});

reportingWorker.on("failed", (job, err) => {
  console.error(`[ReportingWorker] Job ${job?.id} failed: ${err.message}`);
});

export default reportingWorker;
