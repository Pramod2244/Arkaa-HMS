import { prisma } from "@/lib/prisma";
import { AppError } from "@/lib/rbac";
import { createAuditLog } from "@/lib/audit";
import type { Prisma, PharmacyReturnStatus } from "@/app/generated/prisma/client";
import { Prisma as PrismaNamespace } from "@/app/generated/prisma/client";

const Decimal = PrismaNamespace.Decimal;
type DecimalType = InstanceType<typeof Decimal>;

// =====================================================
// TYPES
// =====================================================

interface ReturnItemInput {
  saleItemId: string;
  productId: string;
  batchNumber: string;
  expiryDate: string; // ISO string
  quantityReturned: number;
}

interface CreateReturnInput {
  saleId: string;
  reason: string;
  items: ReturnItemInput[];
}

interface ReturnItemResponse {
  id: string;
  saleItemId: string;
  productId: string;
  productCode: string;
  productName: string;
  genericName: string;
  batchNumber: string;
  expiryDate: string;
  quantityReturned: string;
  unitPrice: string;
  tax: string;
  total: string;
}

interface ReturnListItem {
  id: string;
  returnNumber: string;
  saleNumber: string;
  saleId: string;
  patientId: string | null;
  patientName: string;
  uhid: string;
  returnType: string;
  reason: string;
  status: PharmacyReturnStatus;
  subtotal: string;
  tax: string;
  total: string;
  itemCount: number;
  createdAt: string;
  updatedAt: string;
}

interface ReturnDetail {
  id: string;
  returnNumber: string;
  saleId: string;
  saleNumber: string;
  patientId: string | null;
  patientName: string;
  uhid: string;
  returnType: string;
  reason: string;
  status: PharmacyReturnStatus;
  subtotal: string;
  tax: string;
  total: string;
  version: number;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
  items: ReturnItemResponse[];
}

interface CursorResult<T> {
  data: T[];
  pagination: { cursor: string | null; hasMore: boolean };
}

interface ReturnQueryOptions {
  search?: string;
  status?: string;
  returnType?: string;
  saleId?: string;
  cursor?: string;
  limit?: number;
}

// =====================================================
// RETURN NUMBER GENERATOR
// =====================================================

async function generateReturnNumber(tx: Prisma.TransactionClient, tenantId: string): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `RTN-${year}-`;

  const lastReturn = await tx.pharmacyReturn.findFirst({
    where: {
      tenantId,
      returnNumber: { startsWith: prefix },
    },
    orderBy: { returnNumber: "desc" },
    select: { returnNumber: true },
  });

  let sequence = 1;
  if (lastReturn) {
    const lastSeq = parseInt(lastReturn.returnNumber.replace(prefix, ""), 10);
    if (!isNaN(lastSeq)) sequence = lastSeq + 1;
  }

  return `${prefix}${String(sequence).padStart(5, "0")}`;
}

// =====================================================
// CREATE PHARMACY RETURN (DRAFT)
// =====================================================

export async function createReturn(
  tenantId: string,
  userId: string,
  input: CreateReturnInput
): Promise<ReturnDetail> {
  return prisma.$transaction(async (tx) => {
    // 1. Validate sale
    const sale = await tx.pharmacySale.findFirst({
      where: { id: input.saleId, tenantId, isDeleted: false },
      include: {
        items: { where: { isDeleted: false } },
        patient: { select: { id: true, firstName: true, lastName: true, uhid: true } },
        store: { select: { id: true, name: true, code: true } },
      },
    });

    if (!sale) throw new AppError("Sale not found", 404, "SALE_NOT_FOUND");
    if (sale.status === "CANCELLED") {
      throw new AppError("Cannot return a cancelled sale", 400, "SALE_CANCELLED");
    }
    if (sale.status !== "COMPLETED" && sale.status !== "RETURNED") {
      throw new AppError(`Cannot return a sale in ${sale.status} status`, 400, "SALE_INVALID_STATUS");
    }

    // Build sale item map
    const saleItemMap = new Map(sale.items.map((i) => [i.id, i]));

    // 2. Validate return items
    if (input.items.length === 0) {
      throw new AppError("At least one return item is required", 400, "NO_ITEMS");
    }

    // 3. Fetch products for validation + response
    const productIds = [...new Set(input.items.map((i) => i.productId))];
    const products = await tx.product.findMany({
      where: { id: { in: productIds }, tenantId },
      select: { id: true, name: true, code: true, genericName: true, mrp: true, isNarcotic: true, scheduleType: true },
    });
    const productMap = new Map(products.map((p) => [p.id, p]));

    // 4. Check for existing returns to compute already-returned quantities
    const existingReturns = await tx.pharmacyReturn.findMany({
      where: {
        tenantId,
        saleId: sale.id,
        isDeleted: false,
        status: { not: "CANCELLED" },
      },
      include: { items: true },
    });

    // Map: saleItemId → total already returned
    const alreadyReturned = new Map<string, number>();
    for (const ret of existingReturns) {
      for (const ri of ret.items) {
        alreadyReturned.set(
          ri.saleItemId,
          (alreadyReturned.get(ri.saleItemId) ?? 0) + ri.quantityReturned.toNumber()
        );
      }
    }

    // 5. Validate each item
    let subtotal = new Decimal(0);
    let totalTax = new Decimal(0);

    const validatedItems: Array<{
      saleItemId: string;
      productId: string;
      batchNumber: string;
      expiryDate: Date;
      quantityReturned: number;
      unitPrice: DecimalType;
      tax: DecimalType;
      total: DecimalType;
    }> = [];

    for (const item of input.items) {
      const saleItem = saleItemMap.get(item.saleItemId);
      if (!saleItem) {
        throw new AppError(`Sale item ${item.saleItemId} not found in sale`, 400, "INVALID_SALE_ITEM");
      }

      const product = productMap.get(item.productId);
      if (!product) {
        throw new AppError(`Product ${item.productId} not found`, 404, "PRODUCT_NOT_FOUND");
      }

      // Validate batch match
      if (saleItem.batchNumber !== item.batchNumber) {
        throw new AppError(
          `Batch mismatch for product ${product.name}. Expected: ${saleItem.batchNumber}, Got: ${item.batchNumber}`,
          400,
          "BATCH_MISMATCH"
        );
      }

      // Validate quantity: sold - already_returned >= requested
      const soldQty = saleItem.quantity.toNumber();
      const prevReturned = alreadyReturned.get(item.saleItemId) ?? 0;
      const maxReturnable = soldQty - prevReturned;

      if (item.quantityReturned <= 0) {
        throw new AppError("Return quantity must be positive", 400, "INVALID_QUANTITY");
      }
      if (item.quantityReturned > maxReturnable) {
        throw new AppError(
          `Cannot return ${item.quantityReturned} of ${product.name}. Maximum returnable: ${maxReturnable}`,
          400,
          "EXCEEDS_SOLD_QUANTITY"
        );
      }

      // Controlled drug check
      if (product.isNarcotic) {
        // Log controlled drug return in audit for compliance
        createAuditLog({
          tenantId,
          performedBy: userId,
          entityType: "CONTROLLED_DRUG_RETURN",
          entityId: sale.id,
          action: "CREATE",
          newValue: {
            productId: item.productId,
            productName: product.name,
            saleId: sale.id,
            saleNumber: sale.saleNumber,
            prescriptionId: sale.prescriptionId,
            batchNumber: item.batchNumber,
            quantityReturned: item.quantityReturned,
          },
        });
      }

      const lineUnitPrice = saleItem.unitPrice;
      const lineTax = new Decimal(0); // Tax reversal calculated at line level
      const lineTotal = lineUnitPrice.mul(item.quantityReturned);

      subtotal = subtotal.add(lineTotal);
      totalTax = totalTax.add(lineTax);

      validatedItems.push({
        saleItemId: item.saleItemId,
        productId: item.productId,
        batchNumber: item.batchNumber,
        expiryDate: new Date(item.expiryDate),
        quantityReturned: item.quantityReturned,
        unitPrice: lineUnitPrice,
        tax: lineTax,
        total: lineTotal,
      });
    }

    const total = subtotal.add(totalTax);

    // 6. Determine return type from sale
    const returnType = sale.saleType === "IP" ? "IP_RETURN" : "OP_RETURN";

    // 7. Generate return number
    const returnNumber = await generateReturnNumber(tx, tenantId);

    // 8. Create PharmacyReturn
    const pharmacyReturn = await tx.pharmacyReturn.create({
      data: {
        tenantId,
        returnNumber,
        saleId: sale.id,
        patientId: sale.patientId,
        returnType,
        reason: input.reason,
        status: "DRAFT",
        subtotal,
        tax: totalTax,
        total,
        createdBy: userId,
        updatedBy: userId,
      },
    });

    // 9. Create PharmacyReturnItems
    const returnItems: Array<{
      id: string;
      saleItemId: string;
      productId: string;
      batchNumber: string;
      expiryDate: Date;
      quantityReturned: DecimalType;
      unitPrice: DecimalType;
      tax: DecimalType;
      total: DecimalType;
    }> = [];

    for (const vi of validatedItems) {
      const returnItem = await tx.pharmacyReturnItem.create({
        data: {
          tenantId,
          pharmacyReturnId: pharmacyReturn.id,
          saleItemId: vi.saleItemId,
          productId: vi.productId,
          batchNumber: vi.batchNumber,
          expiryDate: vi.expiryDate,
          quantityReturned: vi.quantityReturned,
          unitPrice: vi.unitPrice,
          tax: vi.tax,
          total: vi.total,
        },
      });

      returnItems.push({
        id: returnItem.id,
        saleItemId: returnItem.saleItemId,
        productId: returnItem.productId,
        batchNumber: returnItem.batchNumber,
        expiryDate: returnItem.expiryDate,
        quantityReturned: returnItem.quantityReturned,
        unitPrice: returnItem.unitPrice,
        tax: returnItem.tax,
        total: returnItem.total,
      });
    }

    // 10. Audit
    createAuditLog({
      tenantId,
      performedBy: userId,
      entityType: "PHARMACY_RETURN",
      entityId: pharmacyReturn.id,
      action: "CREATE",
      newValue: {
        returnNumber,
        saleId: sale.id,
        saleNumber: sale.saleNumber,
        returnType,
        status: "DRAFT",
        total: total.toString(),
        itemCount: validatedItems.length,
      },
    });

    return mapReturnToDetail(pharmacyReturn, sale, sale.patient, returnItems, productMap);
  });
}

// =====================================================
// APPROVE RETURN (CRITICAL — stock reversal + ledger)
// =====================================================

export async function approveReturn(
  tenantId: string,
  userId: string,
  returnId: string,
  version: number
): Promise<ReturnDetail> {
  return prisma.$transaction(async (tx) => {
    // 1. Load return with items + sale
    const pharmacyReturn = await tx.pharmacyReturn.findFirst({
      where: { id: returnId, tenantId, isDeleted: false },
      include: {
        items: true,
        sale: {
          include: {
            patient: { select: { id: true, firstName: true, lastName: true, uhid: true } },
            store: { select: { id: true, name: true, code: true } },
          },
        },
      },
    });

    if (!pharmacyReturn) throw new AppError("Return not found", 404, "RETURN_NOT_FOUND");
    if (pharmacyReturn.status !== "DRAFT") {
      throw new AppError(`Return is in ${pharmacyReturn.status} status, cannot approve`, 400, "RETURN_INVALID_STATUS");
    }
    if (pharmacyReturn.version !== version) {
      throw new AppError("Return has been modified. Refresh and try again.", 409, "VERSION_CONFLICT");
    }

    const sale = pharmacyReturn.sale;

    // 2. Fetch products
    const productIds = [...new Set(pharmacyReturn.items.map((i) => i.productId))];
    const products = await tx.product.findMany({
      where: { id: { in: productIds }, tenantId },
      select: { id: true, name: true, code: true, genericName: true, isNarcotic: true },
    });
    const productMap = new Map(products.map((p) => [p.id, p]));

    // 3. Create RETURN_IN ledger entries (positive quantityChange to restore stock)
    for (const item of pharmacyReturn.items) {
      await tx.inventoryLedger.create({
        data: {
          tenantId,
          storeId: sale.storeId,
          productId: item.productId,
          batchNumber: item.batchNumber,
          expiryDate: item.expiryDate,
          transactionType: "RETURN_IN",
          quantityChange: item.quantityReturned.toNumber(),
          referenceNumber: pharmacyReturn.returnNumber,
          notes: `Return inward: ${pharmacyReturn.returnNumber} against sale ${sale.saleNumber}`,
          createdBy: userId,
        },
      });

      // Controlled drug compliance logging
      const product = productMap.get(item.productId);
      if (product?.isNarcotic) {
        createAuditLog({
          tenantId,
          performedBy: userId,
          entityType: "CONTROLLED_DRUG_RETURN",
          entityId: pharmacyReturn.id,
          action: "UPDATE",
          newValue: {
            returnNumber: pharmacyReturn.returnNumber,
            productId: item.productId,
            productName: product.name,
            saleId: sale.id,
            saleNumber: sale.saleNumber,
            prescriptionId: sale.prescriptionId,
            batchNumber: item.batchNumber,
            quantityReturned: item.quantityReturned.toString(),
            action: "RETURN_APPROVED",
          },
        });
      }
    }

    // 4. Invoice adjustment (OP sale with invoiceId)
    if (sale.invoiceId && sale.saleType === "OP") {
      const invoice = await tx.invoice.findFirst({
        where: { id: sale.invoiceId, tenantId },
      });

      if (invoice) {
        const returnTotal = pharmacyReturn.total.toNumber();

        // Create negative InvoiceItem for the return
        await tx.invoiceItem.create({
          data: {
            tenantId,
            invoiceId: invoice.id,
            itemType: "MEDICINE",
            itemId: pharmacyReturn.id,
            description: `Return: ${pharmacyReturn.returnNumber}`,
            quantity: -1,
            unitPrice: returnTotal,
            discount: 0,
            total: -returnTotal,
          },
        });

        // Update invoice totals
        await tx.invoice.update({
          where: { id: invoice.id },
          data: {
            subtotal: { decrement: returnTotal },
            total: { decrement: returnTotal },
            outstanding: { decrement: returnTotal },
          },
        });
      }
    }

    // 5. IP invoice adjustment
    if (sale.invoiceId && sale.saleType === "IP") {
      const invoice = await tx.invoice.findFirst({
        where: { id: sale.invoiceId, tenantId },
      });

      if (invoice) {
        const returnTotal = pharmacyReturn.total.toNumber();

        await tx.invoiceItem.create({
          data: {
            tenantId,
            invoiceId: invoice.id,
            itemType: "MEDICINE",
            itemId: pharmacyReturn.id,
            description: `IP Return: ${pharmacyReturn.returnNumber}`,
            quantity: -1,
            unitPrice: returnTotal,
            discount: 0,
            total: -returnTotal,
          },
        });

        await tx.invoice.update({
          where: { id: invoice.id },
          data: {
            subtotal: { decrement: returnTotal },
            total: { decrement: returnTotal },
            outstanding: { decrement: returnTotal },
          },
        });
      }
    }

    // 6. Credit adjustment (if original sale was credit)
    if (sale.creditAllowed && sale.patientId) {
      const returnTotal = pharmacyReturn.total;

      // Row-level lock: Prevent concurrent credit updates for the same patient
      await tx.$executeRaw`SELECT id FROM "Patient" WHERE id = ${sale.patientId} FOR UPDATE`;

      // Get current balance
      const lastEntry = await tx.creditLedger.findFirst({
        where: { tenantId, patientId: sale.patientId, isDeleted: false },
        orderBy: { createdAt: "desc" },
        select: { balance: true },
      });

      const currentBalance = lastEntry?.balance ?? new Decimal(0);
      const newBalance = currentBalance.sub(returnTotal);

      // Prevent negative balance
      if (newBalance.lessThan(0)) {
        throw new AppError(
          "Credit adjustment would result in negative balance",
          400,
          "NEGATIVE_CREDIT_BALANCE"
        );
      }

      await tx.creditLedger.create({
        data: {
          tenantId,
          patientId: sale.patientId,
          invoiceId: sale.invoiceId,
          referenceType: "RETURN",
          referenceId: pharmacyReturn.id,
          debitAmount: new Decimal(0),
          creditAmount: returnTotal,
          balance: newBalance,
          notes: `Credit reversal for return ${pharmacyReturn.returnNumber}`,
          createdBy: userId,
          updatedBy: userId,
        },
      });
    }

    // 7. Update return status
    const updatedReturn = await tx.pharmacyReturn.update({
      where: { id: pharmacyReturn.id },
      data: {
        status: "APPROVED",
        updatedBy: userId,
        version: { increment: 1 },
      },
    });

    // 8. Mark original sale as RETURNED if all items fully returned
    const allSaleItems = await tx.pharmacySaleItem.findMany({
      where: { saleId: sale.id, tenantId, isDeleted: false },
    });

    const allReturns = await tx.pharmacyReturn.findMany({
      where: { saleId: sale.id, tenantId, isDeleted: false, status: "APPROVED" },
      include: { items: true },
    });

    // Include the current return (just approved)
    const totalReturnedMap = new Map<string, number>();
    for (const ret of allReturns) {
      for (const ri of ret.items) {
        totalReturnedMap.set(
          ri.saleItemId,
          (totalReturnedMap.get(ri.saleItemId) ?? 0) + ri.quantityReturned.toNumber()
        );
      }
    }

    const allFullyReturned = allSaleItems.every((si) => {
      const returned = totalReturnedMap.get(si.id) ?? 0;
      return returned >= si.quantity.toNumber();
    });

    if (allFullyReturned) {
      await tx.pharmacySale.update({
        where: { id: sale.id },
        data: { status: "RETURNED", updatedBy: userId, version: { increment: 1 } },
      });
    }

    // 9. Audit
    createAuditLog({
      tenantId,
      performedBy: userId,
      entityType: "PHARMACY_RETURN",
      entityId: pharmacyReturn.id,
      action: "UPDATE",
      oldValue: { status: "DRAFT" },
      newValue: {
        status: "APPROVED",
        returnNumber: pharmacyReturn.returnNumber,
        total: pharmacyReturn.total.toString(),
      },
    });

    const returnItems = pharmacyReturn.items.map((i) => ({
      id: i.id,
      saleItemId: i.saleItemId,
      productId: i.productId,
      batchNumber: i.batchNumber,
      expiryDate: i.expiryDate,
      quantityReturned: i.quantityReturned,
      unitPrice: i.unitPrice,
      tax: i.tax,
      total: i.total,
    }));

    return mapReturnToDetail(updatedReturn, sale, sale.patient, returnItems, productMap);
  });
}

// =====================================================
// CANCEL RETURN
// =====================================================

export async function cancelReturn(
  tenantId: string,
  userId: string,
  returnId: string,
  version: number
): Promise<{ success: boolean }> {
  return prisma.$transaction(async (tx) => {
    const pharmacyReturn = await tx.pharmacyReturn.findFirst({
      where: { id: returnId, tenantId, isDeleted: false },
    });

    if (!pharmacyReturn) throw new AppError("Return not found", 404, "RETURN_NOT_FOUND");
    if (pharmacyReturn.status === "CANCELLED") {
      throw new AppError("Return is already cancelled", 400, "RETURN_ALREADY_CANCELLED");
    }
    if (pharmacyReturn.status === "APPROVED") {
      throw new AppError("Cannot cancel an approved return. Please create a new sale instead.", 400, "RETURN_ALREADY_APPROVED");
    }
    if (pharmacyReturn.version !== version) {
      throw new AppError("Return has been modified. Refresh and try again.", 409, "VERSION_CONFLICT");
    }

    await tx.pharmacyReturn.update({
      where: { id: pharmacyReturn.id },
      data: {
        status: "CANCELLED",
        updatedBy: userId,
        version: { increment: 1 },
      },
    });

    createAuditLog({
      tenantId,
      performedBy: userId,
      entityType: "PHARMACY_RETURN",
      entityId: pharmacyReturn.id,
      action: "UPDATE",
      oldValue: { status: pharmacyReturn.status },
      newValue: { status: "CANCELLED" },
    });

    return { success: true };
  });
}

// =====================================================
// GET RETURNS (cursor pagination)
// =====================================================

export async function getReturnsCursor(
  tenantId: string,
  options: ReturnQueryOptions
): Promise<CursorResult<ReturnListItem>> {
  const limit = options.limit ?? 20;
  const where: Prisma.PharmacyReturnWhereInput = {
    tenantId,
    isDeleted: false,
  };

  if (options.search) {
    where.OR = [
      { returnNumber: { contains: options.search, mode: "insensitive" } },
      { sale: { saleNumber: { contains: options.search, mode: "insensitive" } } },
      { patient: { firstName: { contains: options.search, mode: "insensitive" } } },
      { patient: { lastName: { contains: options.search, mode: "insensitive" } } },
      { patient: { uhid: { contains: options.search, mode: "insensitive" } } },
    ];
  }

  if (options.status) {
    where.status = options.status as PharmacyReturnStatus;
  }
  if (options.returnType) {
    where.returnType = options.returnType === "OP_RETURN" ? "OP_RETURN" : "IP_RETURN";
  }
  if (options.saleId) {
    where.saleId = options.saleId;
  }

  const queryArgs: Prisma.PharmacyReturnFindManyArgs = {
    where,
    orderBy: { createdAt: "desc" },
    take: limit + 1,
    select: {
      id: true,
      returnNumber: true,
      saleId: true,
      sale: { select: { saleNumber: true } },
      patientId: true,
      patient: { select: { firstName: true, lastName: true, uhid: true } },
      returnType: true,
      reason: true,
      status: true,
      subtotal: true,
      tax: true,
      total: true,
      createdAt: true,
      updatedAt: true,
      _count: { select: { items: true } },
    },
  };

  if (options.cursor) {
    queryArgs.skip = 1;
    queryArgs.cursor = { id: options.cursor };
  }

  const records = await prisma.pharmacyReturn.findMany(queryArgs);
  const hasMore = records.length > limit;
  const data = records.slice(0, limit);

  return {
    data: data.map((r) => {
      const rec = r as typeof r & {
        sale: { saleNumber: string };
        patient: { firstName: string; lastName: string | null; uhid: string | null } | null;
        _count: { items: number };
      };
      return {
        id: rec.id,
        returnNumber: rec.returnNumber,
        saleNumber: rec.sale.saleNumber,
        saleId: rec.saleId,
        patientId: rec.patientId,
        patientName: rec.patient ? `${rec.patient.firstName} ${rec.patient.lastName ?? ""}`.trim() : "N/A",
        uhid: rec.patient?.uhid ?? "",
        returnType: rec.returnType,
        reason: rec.reason,
        status: rec.status,
        subtotal: rec.subtotal.toString(),
        tax: rec.tax.toString(),
        total: rec.total.toString(),
        itemCount: rec._count.items,
        createdAt: rec.createdAt.toISOString(),
        updatedAt: rec.updatedAt.toISOString(),
      };
    }),
    pagination: {
      cursor: hasMore && data.length > 0 ? data[data.length - 1].id : null,
      hasMore,
    },
  };
}

// =====================================================
// GET RETURN DETAIL BY ID
// =====================================================

export async function getReturnById(
  tenantId: string,
  returnId: string
): Promise<ReturnDetail> {
  const pharmacyReturn = await prisma.pharmacyReturn.findFirst({
    where: { id: returnId, tenantId, isDeleted: false },
    include: {
      items: true,
      sale: {
        include: {
          patient: { select: { id: true, firstName: true, lastName: true, uhid: true } },
          store: { select: { id: true, name: true, code: true } },
        },
      },
    },
  });

  if (!pharmacyReturn) throw new AppError("Return not found", 404, "RETURN_NOT_FOUND");

  const productIds = [...new Set(pharmacyReturn.items.map((i) => i.productId))];
  const products = await prisma.product.findMany({
    where: { id: { in: productIds }, tenantId },
    select: { id: true, name: true, code: true, genericName: true },
  });
  const productMap = new Map(products.map((p) => [p.id, p]));

  const returnItems = pharmacyReturn.items.map((i) => ({
    id: i.id,
    saleItemId: i.saleItemId,
    productId: i.productId,
    batchNumber: i.batchNumber,
    expiryDate: i.expiryDate,
    quantityReturned: i.quantityReturned,
    unitPrice: i.unitPrice,
    tax: i.tax,
    total: i.total,
  }));

  return mapReturnToDetail(pharmacyReturn, pharmacyReturn.sale, pharmacyReturn.sale.patient, returnItems, productMap);
}

// =====================================================
// HELPER: Map return to detail response
// =====================================================

function mapReturnToDetail(
  ret: {
    id: string;
    returnNumber: string;
    saleId: string;
    patientId: string | null;
    returnType: string;
    reason: string;
    status: PharmacyReturnStatus;
    subtotal: DecimalType;
    tax: DecimalType;
    total: DecimalType;
    version: number;
    createdBy: string;
    updatedBy: string;
    createdAt: Date;
    updatedAt: Date;
  },
  sale: { id: string; saleNumber: string },
  patient: { id: string; firstName: string; lastName: string | null; uhid: string | null } | null,
  items: Array<{
    id: string;
    saleItemId: string;
    productId: string;
    batchNumber: string;
    expiryDate: Date;
    quantityReturned: DecimalType;
    unitPrice: DecimalType;
    tax: DecimalType;
    total: DecimalType;
  }>,
  productMap: Map<string, { id: string; name: string; code: string | null; genericName: string | null }>
): ReturnDetail {
  return {
    id: ret.id,
    returnNumber: ret.returnNumber,
    saleId: ret.saleId,
    saleNumber: sale.saleNumber,
    patientId: ret.patientId,
    patientName: patient ? `${patient.firstName} ${patient.lastName ?? ""}`.trim() : "N/A",
    uhid: patient?.uhid ?? "",
    returnType: ret.returnType,
    reason: ret.reason,
    status: ret.status,
    subtotal: ret.subtotal.toString(),
    tax: ret.tax.toString(),
    total: ret.total.toString(),
    version: ret.version,
    createdBy: ret.createdBy,
    updatedBy: ret.updatedBy,
    createdAt: ret.createdAt.toISOString(),
    updatedAt: ret.updatedAt.toISOString(),
    items: items.map((i) => {
      const p = productMap.get(i.productId);
      return {
        id: i.id,
        saleItemId: i.saleItemId,
        productId: i.productId,
        productCode: p?.code ?? "",
        productName: p?.name ?? "",
        genericName: p?.genericName ?? "",
        batchNumber: i.batchNumber,
        expiryDate: i.expiryDate.toISOString(),
        quantityReturned: i.quantityReturned.toString(),
        unitPrice: i.unitPrice.toString(),
        tax: i.tax.toString(),
        total: i.total.toString(),
      };
    }),
  };
}
