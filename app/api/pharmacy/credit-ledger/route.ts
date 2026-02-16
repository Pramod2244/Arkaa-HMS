import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { AppError } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { CreditLedgerQuerySchema } from "@/lib/schemas/pharmacy-dispensing-schema";
import type { Prisma } from "@/app/generated/prisma/client";

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, errorCode: "UNAUTHORIZED", message: "Not authenticated" },
        { status: 401 }
      );
    }
    if (!session.tenantId) {
      return NextResponse.json(
        { success: false, errorCode: "BAD_REQUEST", message: "Tenant context required" },
        { status: 400 }
      );
    }
    if (!session.permissions.includes("PHARMACY_CREDIT_VIEW")) {
      return NextResponse.json(
        { success: false, errorCode: "FORBIDDEN", message: "Access denied" },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const queryData = {
      patientId: searchParams.get("patientId") || undefined,
      referenceType: searchParams.get("referenceType") || undefined,
      limit: searchParams.get("limit") ? parseInt(searchParams.get("limit")!) : 20,
      cursor: searchParams.get("cursor") || undefined,
    };

    const validatedQuery = CreditLedgerQuerySchema.parse(queryData);

    const limit = validatedQuery.limit;
    const where: Prisma.CreditLedgerWhereInput = {
      tenantId: session.tenantId,
      isDeleted: false,
    };

    if (validatedQuery.patientId) where.patientId = validatedQuery.patientId;
    if (validatedQuery.referenceType) where.referenceType = validatedQuery.referenceType;

    const queryArgs: Prisma.CreditLedgerFindManyArgs = {
      where,
      orderBy: { createdAt: "desc" },
      take: limit + 1,
      select: {
        id: true,
        patientId: true,
        patient: { select: { firstName: true, lastName: true, uhid: true } },
        invoiceId: true,
        referenceType: true,
        referenceId: true,
        debitAmount: true,
        creditAmount: true,
        balance: true,
        notes: true,
        createdAt: true,
        createdBy: true,
      },
    };

    if (validatedQuery.cursor) {
      queryArgs.skip = 1;
      queryArgs.cursor = { id: validatedQuery.cursor };
    }

    const records = await prisma.creditLedger.findMany(queryArgs);
    const hasMore = records.length > limit;
    const data = records.slice(0, limit);

    return NextResponse.json({
      success: true,
      data: data.map((r) => {
        const rec = r as typeof r & {
          patient: { firstName: string; lastName: string; uhid: string | null };
        };
        return {
          id: rec.id,
          patientId: rec.patientId,
          patientName: `${rec.patient.firstName} ${rec.patient.lastName}`,
          uhid: rec.patient.uhid ?? "",
          invoiceId: rec.invoiceId,
          referenceType: rec.referenceType,
          referenceId: rec.referenceId,
          debitAmount: rec.debitAmount.toString(),
          creditAmount: rec.creditAmount.toString(),
          balance: rec.balance.toString(),
          notes: rec.notes,
          createdAt: rec.createdAt.toISOString(),
          createdBy: rec.createdBy,
        };
      }),
      pagination: {
        cursor: hasMore && data.length > 0 ? data[data.length - 1].id : null,
        hasMore,
      },
    });
  } catch (error) {
    console.error("GET /api/pharmacy/credit-ledger error:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, errorCode: "VALIDATION_ERROR", message: error.issues.map((i) => i.message).join(", ") },
        { status: 400 }
      );
    }
    if (error instanceof AppError) {
      return NextResponse.json(
        { success: false, errorCode: error.errorCode, message: error.message },
        { status: error.statusCode }
      );
    }
    return NextResponse.json(
      { success: false, errorCode: "INTERNAL_ERROR", message: error instanceof Error ? error.message : "An error occurred" },
      { status: 500 }
    );
  }
}
