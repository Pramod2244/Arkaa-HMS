import { prisma } from "@/lib/prisma";
import { AppError } from "@/lib/rbac";
import { createAuditLog } from "@/lib/audit";
import type { Prisma, PharmacySaleStatus } from "@/app/generated/prisma/client";
import { Prisma as PrismaNamespace } from "@/app/generated/prisma/client";
import { allocateStockFIFO } from "./stock-allocation.service";

const Decimal = PrismaNamespace.Decimal;
type DecimalType = InstanceType<typeof Decimal>;

// =====================================================
// TYPES
// =====================================================

interface SaleItemInput {
  productId: string;
  quantity: number;
  discount?: number;
}

interface CreateOPSaleInput {
  patientId: string;
  storeId: string;
  visitId?: string;
  prescriptionId?: string;
  creditAllowed?: boolean;
  notes?: string;
  items: SaleItemInput[];
}

interface SaleItemResponse {
  id: string;
  productId: string;
  productCode: string;
  productName: string;
  genericName: string;
  batchNumber: string;
  expiryDate: string;
  quantity: string;
  unitPrice: string;
  discount: string;
  tax: string;
  total: string;
}

interface SaleListItem {
  id: string;
  saleNumber: string;
  patientId: string;
  patientName: string;
  uhid: string;
  storeId: string;
  storeName: string;
  saleType: string;
  status: PharmacySaleStatus;
  totalAmount: string;
  discount: string;
  netAmount: string;
  creditAllowed: boolean;
  itemCount: number;
  createdAt: string;
  updatedAt: string;
}

interface SaleDetail {
  id: string;
  saleNumber: string;
  patientId: string;
  patientName: string;
  uhid: string;
  storeId: string;
  storeName: string;
  storeCode: string;
  visitId: string | null;
  prescriptionId: string | null;
  saleType: string;
  status: PharmacySaleStatus;
  totalAmount: string;
  discount: string;
  tax: string;
  netAmount: string;
  creditAllowed: boolean;
  invoiceId: string | null;
  notes: string | null;
  version: number;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
  items: SaleItemResponse[];
}

interface CursorResult<T> {
  data: T[];
  pagination: { cursor: string | null; hasMore: boolean };
}

interface OPSaleQueryOptions {
  search?: string;
  status?: string;
  storeId?: string;
  patientId?: string;
  cursor?: string;
  limit?: number;
}

// =====================================================
// SALE NUMBER GENERATOR
// =====================================================

async function generateSaleNumber(
  tenantId: string,
  tx: Prisma.TransactionClient
): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `SALE-${year}-`;

  const last = await tx.pharmacySale.findFirst({
    where: { tenantId, saleNumber: { startsWith: prefix } },
    orderBy: { saleNumber: "desc" },
    select: { saleNumber: true },
  });

  let seq = 1;
  if (last) {
    const num = parseInt(last.saleNumber.replace(prefix, ""), 10);
    if (!isNaN(num)) seq = num + 1;
  }

  return `${prefix}${String(seq).padStart(5, "0")}`;
}

// =====================================================
// DISCOUNT THRESHOLD (configurable per tenant in future)
// =====================================================

const DISCOUNT_APPROVAL_THRESHOLD_PERCENT = 10;

// =====================================================
// CREATE OP SALE
// Enterprise flow: Sale → FIFO Allocate → Ledger (OUT) → Invoice (optional)
// =====================================================

export async function createOPSale(
  tenantId: string,
  userId: string,
  input: CreateOPSaleInput
): Promise<SaleDetail> {
  return prisma.$transaction(async (tx) => {
    // 1. Validate patient
    const patient = await tx.patient.findFirst({
      where: { id: input.patientId, tenantId, status: "ACTIVE" },
      select: { id: true, firstName: true, lastName: true, uhid: true },
    });
    if (!patient) throw new AppError("Patient not found or inactive", 404, "PATIENT_NOT_FOUND");

    // 2. Validate store
    const store = await tx.store.findFirst({
      where: { id: input.storeId, tenantId, isDeleted: false, status: "ACTIVE" },
      select: { id: true, name: true, code: true },
    });
    if (!store) throw new AppError("Store not found or inactive", 404, "STORE_NOT_FOUND");

    // 3. Validate prescription (if linked) - required for narcotic drugs
    let prescriptionDoctorId: string | null = null;
    if (input.prescriptionId) {
      const prescription = await tx.prescription.findFirst({
        where: { id: input.prescriptionId, tenantId, status: "ACTIVE" },
        select: { id: true, doctorId: true },
      });
      if (!prescription) throw new AppError("Prescription not found or cancelled", 404, "PRESCRIPTION_NOT_FOUND");
      prescriptionDoctorId = prescription.doctorId;
    }

    // 4. Validate & fetch products
    const productIds = [...new Set(input.items.map((i) => i.productId))];
    const products = await tx.product.findMany({
      where: { id: { in: productIds }, tenantId, isDeleted: false, status: "ACTIVE" },
      select: { id: true, name: true, code: true, genericName: true, mrp: true, isNarcotic: true },
    });
    const productMap = new Map(products.map((p) => [p.id, p]));

    for (const item of input.items) {
      const product = productMap.get(item.productId);
      if (!product) throw new AppError(`Product ${item.productId} not found or inactive`, 404, "PRODUCT_NOT_FOUND");

      // Narcotic check: must have a prescription with a doctor
      if (product.isNarcotic && !prescriptionDoctorId) {
        throw new AppError(
          `Product "${product.name}" is a controlled substance. A valid prescription is required.`,
          400,
          "NARCOTIC_REQUIRES_PRESCRIPTION"
        );
      }
    }

    // 5. Generate sale number
    const saleNumber = await generateSaleNumber(tenantId, tx);

    // 6. Calculate totals and determine discount approval
    let totalAmount = new Decimal(0);
    let totalDiscount = new Decimal(0);

    // Pre-calculate totals for discount threshold check
    for (const item of input.items) {
      const product = productMap.get(item.productId)!;
      const lineTotal = new Decimal((product.mrp ?? 0).toString()).mul(item.quantity);
      const lineDiscount = new Decimal(item.discount ?? 0);
      totalAmount = totalAmount.add(lineTotal);
      totalDiscount = totalDiscount.add(lineDiscount.mul(item.quantity));
    }

    const discountPercent = totalAmount.gt(0)
      ? totalDiscount.div(totalAmount).mul(100).toNumber()
      : 0;

    const needsApproval = discountPercent > DISCOUNT_APPROVAL_THRESHOLD_PERCENT;
    const saleStatus: PharmacySaleStatus = needsApproval ? "PENDING_APPROVAL" : "COMPLETED";

    const tax = new Decimal(0); // Tax calculation can be extended later
    const netAmount = totalAmount.sub(totalDiscount).add(tax);

    // 7. Create PharmacySale
    const sale = await tx.pharmacySale.create({
      data: {
        tenantId,
        saleNumber,
        patientId: input.patientId,
        visitId: input.visitId ?? null,
        storeId: input.storeId,
        saleType: "OP",
        status: saleStatus,
        totalAmount,
        discount: totalDiscount,
        tax,
        netAmount,
        creditAllowed: input.creditAllowed ?? false,
        prescriptionId: input.prescriptionId ?? null,
        createdBy: userId,
        updatedBy: userId,
      },
    });

    // 8. FIFO allocate & create sale items (only if not pending approval)
    const saleItems: Array<{
      id: string;
      productId: string;
      batchNumber: string;
      expiryDate: Date;
      quantity: DecimalType;
      unitPrice: DecimalType;
      discount: DecimalType;
      tax: DecimalType;
      total: DecimalType;
      ledgerEntryId: string | null;
    }> = [];

    if (saleStatus === "COMPLETED") {
      // Allocate stock via FIFO and create sale items
      for (const item of input.items) {
        const product = productMap.get(item.productId)!;

        const allocation = await allocateStockFIFO(tx, {
          tenantId,
          storeId: input.storeId,
          productId: item.productId,
          requiredQty: item.quantity,
          referenceNumber: saleNumber,
          userId,
        });

        // Create one sale item per batch allocation
        for (const batch of allocation.allocations) {
          const lineUnitPrice = new Decimal((product.mrp ?? 0).toString());
          const lineDiscount = new Decimal(item.discount ?? 0);
          const lineTotal = lineUnitPrice.mul(batch.allocatedQty).sub(lineDiscount.mul(batch.allocatedQty));
          const lineTax = new Decimal(0);

          const saleItem = await tx.pharmacySaleItem.create({
            data: {
              tenantId,
              saleId: sale.id,
              productId: item.productId,
              batchNumber: batch.batchNumber,
              expiryDate: batch.expiryDate ?? new Date("2099-12-31"),
              quantity: new Decimal(batch.allocatedQty),
              unitPrice: lineUnitPrice,
              discount: lineDiscount.mul(batch.allocatedQty),
              tax: lineTax,
              total: lineTotal,
              ledgerEntryId: batch.ledgerEntryId,
              createdBy: userId,
              updatedBy: userId,
            },
          });

          saleItems.push({
            id: saleItem.id,
            productId: item.productId,
            batchNumber: batch.batchNumber,
            expiryDate: batch.expiryDate ?? new Date("2099-12-31"),
            quantity: new Decimal(batch.allocatedQty),
            unitPrice: lineUnitPrice,
            discount: lineDiscount.mul(batch.allocatedQty),
            tax: lineTax,
            total: lineTotal,
            ledgerEntryId: batch.ledgerEntryId,
          });
        }

        // Mark prescription items as dispensed (if linked)
        if (input.prescriptionId) {
          await tx.prescriptionItem.updateMany({
            where: {
              prescriptionId: input.prescriptionId,
              tenantId,
              medicineName: product.name,
              isDispensed: false,
            },
            data: {
              isDispensed: true,
              dispensedAt: new Date(),
              dispensedBy: userId,
            },
          });
        }
      }
    } else {
      // PENDING_APPROVAL: Create sale items without stock allocation (no ledger entries)
      for (const item of input.items) {
        const product = productMap.get(item.productId)!;
        const lineUnitPrice = new Decimal((product.mrp ?? 0).toString());
        const lineDiscount = new Decimal(item.discount ?? 0);
        const lineTotal = lineUnitPrice.mul(item.quantity).sub(lineDiscount.mul(item.quantity));
        const lineTax = new Decimal(0);

        const saleItem = await tx.pharmacySaleItem.create({
          data: {
            tenantId,
            saleId: sale.id,
            productId: item.productId,
            batchNumber: "PENDING",
            expiryDate: new Date("2099-12-31"),
            quantity: new Decimal(item.quantity),
            unitPrice: lineUnitPrice,
            discount: lineDiscount.mul(item.quantity),
            tax: lineTax,
            total: lineTotal,
            ledgerEntryId: null,
            createdBy: userId,
            updatedBy: userId,
          },
        });

        saleItems.push({
          id: saleItem.id,
          productId: item.productId,
          batchNumber: "PENDING",
          expiryDate: new Date("2099-12-31"),
          quantity: new Decimal(item.quantity),
          unitPrice: lineUnitPrice,
          discount: lineDiscount.mul(item.quantity),
          tax: lineTax,
          total: lineTotal,
          ledgerEntryId: null,
        });
      }
    }

    // 9. Create Invoice (only if visitId provided and sale is COMPLETED)
    let invoiceId: string | null = null;
    if (input.visitId && saleStatus === "COMPLETED") {
      const invoiceNumber = `INV-${saleNumber}`;

      const invoice = await tx.invoice.create({
        data: {
          tenantId,
          visitId: input.visitId,
          patientId: input.patientId,
          invoiceNumber,
          invoiceDate: new Date(),
          status: (input.creditAllowed ? "DRAFT" : "FINAL") as "DRAFT" | "FINAL",
          subtotal: netAmount.toNumber(),
          discount: totalDiscount.toNumber(),
          tax: tax.toNumber(),
          total: netAmount.toNumber(),
          paidAmount: input.creditAllowed ? 0 : netAmount.toNumber(),
          outstanding: input.creditAllowed ? netAmount.toNumber() : 0,
          notes: `Pharmacy sale ${saleNumber}`,
          createdBy: userId,
          updatedBy: userId,
        },
      });

      // Create invoice items
      for (const si of saleItems) {
        const product = productMap.get(si.productId)!;
        await tx.invoiceItem.create({
          data: {
            tenantId,
            invoiceId: invoice.id,
            itemType: "MEDICINE",
            itemId: sale.id,
            description: `${product.name} (Batch: ${si.batchNumber})`,
            quantity: si.quantity.toNumber(),
            unitPrice: si.unitPrice.toNumber(),
            discount: si.discount.toNumber(),
            total: si.total.toNumber(),
          },
        });
      }

      invoiceId = invoice.id;

      // Update sale with invoiceId
      await tx.pharmacySale.update({
        where: { id: sale.id },
        data: { invoiceId },
      });
    }

    // 10. Create credit ledger entry (if credit allowed)
    if (input.creditAllowed && saleStatus === "COMPLETED") {
      // Calculate running balance for this patient
      const lastEntry = await tx.creditLedger.findFirst({
        where: { tenantId, patientId: input.patientId, isDeleted: false },
        orderBy: { createdAt: "desc" },
        select: { balance: true },
      });

      const previousBalance = lastEntry ? new Decimal(lastEntry.balance.toString()) : new Decimal(0);
      const newBalance = previousBalance.add(netAmount);

      await tx.creditLedger.create({
        data: {
          tenantId,
          patientId: input.patientId,
          invoiceId,
          referenceType: "PHARMACY_SALE",
          referenceId: sale.id,
          debitAmount: netAmount,
          creditAmount: new Decimal(0),
          balance: newBalance,
          notes: `Pharmacy sale ${saleNumber}`,
          createdBy: userId,
          updatedBy: userId,
        },
      });
    }

    // 11. Audit log
    createAuditLog({
      tenantId,
      performedBy: userId,
      entityType: "PHARMACY_SALE",
      entityId: sale.id,
      action: "CREATE",
      newValue: { saleNumber, saleType: "OP", status: saleStatus, netAmount: netAmount.toString() },
    });

    // 12. Return mapped response
    return mapSaleToDetail(sale, store, patient, saleItems, productMap);
  });
}

// =====================================================
// APPROVE PENDING SALE (discount-approved → allocate stock)
// =====================================================

export async function approveSale(
  tenantId: string,
  userId: string,
  saleId: string,
  version: number
): Promise<SaleDetail> {
  return prisma.$transaction(async (tx) => {
    const sale = await tx.pharmacySale.findFirst({
      where: { id: saleId, tenantId, isDeleted: false },
      include: {
        items: { where: { isDeleted: false } },
        patient: { select: { id: true, firstName: true, lastName: true, uhid: true } },
        store: { select: { id: true, name: true, code: true } },
      },
    });

    if (!sale) throw new AppError("Sale not found", 404, "SALE_NOT_FOUND");
    if (sale.status !== "PENDING_APPROVAL") {
      throw new AppError(`Sale is in ${sale.status} status, cannot approve`, 400, "SALE_INVALID_STATUS");
    }
    if (sale.version !== version) {
      throw new AppError("Sale has been modified. Refresh and try again.", 409, "VERSION_CONFLICT");
    }

    // Fetch products for response mapping
    const productIds = [...new Set(sale.items.map((i) => i.productId))];
    const products = await tx.product.findMany({
      where: { id: { in: productIds }, tenantId },
      select: { id: true, name: true, code: true, genericName: true, mrp: true, isNarcotic: true },
    });
    const productMap = new Map(products.map((p) => [p.id, p]));

    // Allocate stock via FIFO for each item
    const updatedItems: typeof sale.items = [];
    for (const item of sale.items) {
      const allocation = await allocateStockFIFO(tx, {
        tenantId,
        storeId: sale.storeId,
        productId: item.productId,
        requiredQty: item.quantity.toNumber(),
        referenceNumber: sale.saleNumber,
        userId,
      });

      // Update sale items with actual batch info
      let idx = 0;
      for (const batch of allocation.allocations) {
        if (idx === 0) {
          // Update existing item
          const updated = await tx.pharmacySaleItem.update({
            where: { id: item.id },
            data: {
              batchNumber: batch.batchNumber,
              expiryDate: batch.expiryDate ?? new Date("2099-12-31"),
              quantity: new Decimal(batch.allocatedQty),
              ledgerEntryId: batch.ledgerEntryId,
              updatedBy: userId,
            },
          });
          updatedItems.push(updated);
        } else {
          // Create additional items for split batches
          const created = await tx.pharmacySaleItem.create({
            data: {
              tenantId,
              saleId: sale.id,
              productId: item.productId,
              batchNumber: batch.batchNumber,
              expiryDate: batch.expiryDate ?? new Date("2099-12-31"),
              quantity: new Decimal(batch.allocatedQty),
              unitPrice: item.unitPrice,
              discount: new Decimal(0),
              tax: new Decimal(0),
              total: item.unitPrice.mul(batch.allocatedQty),
              ledgerEntryId: batch.ledgerEntryId,
              createdBy: userId,
              updatedBy: userId,
            },
          });
          updatedItems.push(created);
        }
        idx++;
      }
    }

    // Update sale status to COMPLETED
    const updatedSale = await tx.pharmacySale.update({
      where: { id: sale.id },
      data: { status: "COMPLETED", updatedBy: userId, version: { increment: 1 } },
    });

    createAuditLog({
      tenantId,
      performedBy: userId,
      entityType: "PHARMACY_SALE",
      entityId: sale.id,
      action: "UPDATE",
      oldValue: { status: "PENDING_APPROVAL" },
      newValue: { status: "COMPLETED" },
    });

    const itemsForMap = updatedItems.map((i) => ({
      id: i.id,
      productId: i.productId,
      batchNumber: i.batchNumber,
      expiryDate: i.expiryDate,
      quantity: i.quantity,
      unitPrice: i.unitPrice,
      discount: i.discount,
      tax: i.tax,
      total: i.total,
      ledgerEntryId: i.ledgerEntryId,
    }));

    return mapSaleToDetail(
      updatedSale,
      sale.store,
      sale.patient,
      itemsForMap,
      productMap
    );
  });
}

// =====================================================
// GET OP SALES (cursor pagination)
// =====================================================

export async function getOPSalesCursor(
  tenantId: string,
  options: OPSaleQueryOptions
): Promise<CursorResult<SaleListItem>> {
  const limit = options.limit ?? 20;
  const where: Prisma.PharmacySaleWhereInput = {
    tenantId,
    isDeleted: false,
    saleType: "OP",
  };

  if (options.search) {
    where.OR = [
      { saleNumber: { contains: options.search, mode: "insensitive" } },
      { patient: { firstName: { contains: options.search, mode: "insensitive" } } },
      { patient: { lastName: { contains: options.search, mode: "insensitive" } } },
      { patient: { uhid: { contains: options.search, mode: "insensitive" } } },
    ];
  }

  if (options.status) {
    where.status = options.status as PharmacySaleStatus;
  }
  if (options.storeId) {
    where.storeId = options.storeId;
  }
  if (options.patientId) {
    where.patientId = options.patientId;
  }

  const queryArgs: Prisma.PharmacySaleFindManyArgs = {
    where,
    orderBy: { createdAt: "desc" },
    take: limit + 1,
    select: {
      id: true,
      saleNumber: true,
      patientId: true,
      patient: { select: { firstName: true, lastName: true, uhid: true } },
      storeId: true,
      store: { select: { name: true } },
      saleType: true,
      status: true,
      totalAmount: true,
      discount: true,
      netAmount: true,
      creditAllowed: true,
      createdAt: true,
      updatedAt: true,
      _count: { select: { items: true } },
    },
  };

  if (options.cursor) {
    queryArgs.skip = 1;
    queryArgs.cursor = { id: options.cursor };
  }

  const records = await prisma.pharmacySale.findMany(queryArgs);
  const hasMore = records.length > limit;
  const data = records.slice(0, limit);

  return {
    data: data.map((r) => {
      const rec = r as typeof r & {
        patient: { firstName: string; lastName: string | null; uhid: string | null };
        store: { name: string };
        _count: { items: number };
      };
      return {
        id: rec.id,
        saleNumber: rec.saleNumber,
        patientId: rec.patientId,
        patientName: rec.patient.lastName ? `${rec.patient.firstName} ${rec.patient.lastName}` : rec.patient.firstName,
        uhid: rec.patient.uhid ?? "",
        storeId: rec.storeId,
        storeName: rec.store.name,
        saleType: rec.saleType,
        status: rec.status,
        totalAmount: rec.totalAmount.toString(),
        discount: rec.discount.toString(),
        netAmount: rec.netAmount.toString(),
        creditAllowed: rec.creditAllowed,
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
// GET SALE DETAIL BY ID
// =====================================================

export async function getOPSaleById(
  tenantId: string,
  saleId: string
): Promise<SaleDetail> {
  const sale = await prisma.pharmacySale.findFirst({
    where: { id: saleId, tenantId, isDeleted: false },
    include: {
      patient: { select: { id: true, firstName: true, lastName: true, uhid: true } },
      store: { select: { id: true, name: true, code: true } },
      items: {
        where: { isDeleted: false },
        include: {
          product: { select: { id: true, name: true, code: true, genericName: true, mrp: true } },
        },
      },
    },
  });

  if (!sale) throw new AppError("Sale not found", 404, "SALE_NOT_FOUND");

  const items: SaleItemResponse[] = sale.items.map((i) => ({
    id: i.id,
    productId: i.productId,
    productCode: i.product.code ?? "",
    productName: i.product.name,
    genericName: i.product.genericName ?? "",
    batchNumber: i.batchNumber,
    expiryDate: i.expiryDate.toISOString(),
    quantity: i.quantity.toString(),
    unitPrice: i.unitPrice.toString(),
    discount: i.discount.toString(),
    tax: i.tax.toString(),
    total: i.total.toString(),
  }));

  return {
    id: sale.id,
    saleNumber: sale.saleNumber,
    patientId: sale.patientId,
    patientName: sale.patient.lastName ? `${sale.patient.firstName} ${sale.patient.lastName}` : sale.patient.firstName,
    uhid: sale.patient.uhid ?? "",
    storeId: sale.storeId,
    storeName: sale.store.name,
    storeCode: sale.store.code ?? "",
    visitId: sale.visitId,
    prescriptionId: sale.prescriptionId,
    saleType: sale.saleType,
    status: sale.status,
    totalAmount: sale.totalAmount.toString(),
    discount: sale.discount.toString(),
    tax: sale.tax.toString(),
    netAmount: sale.netAmount.toString(),
    creditAllowed: sale.creditAllowed,
    invoiceId: sale.invoiceId,
    notes: null,
    version: sale.version,
    createdBy: sale.createdBy,
    updatedBy: sale.updatedBy,
    createdAt: sale.createdAt.toISOString(),
    updatedAt: sale.updatedAt.toISOString(),
    items,
  };
}

// =====================================================
// CANCEL SALE (reverse stock if completed)
// =====================================================

export async function cancelSale(
  tenantId: string,
  userId: string,
  saleId: string,
  version: number
): Promise<{ success: boolean }> {
  return prisma.$transaction(async (tx) => {
    const sale = await tx.pharmacySale.findFirst({
      where: { id: saleId, tenantId, isDeleted: false },
      include: { items: { where: { isDeleted: false } } },
    });

    if (!sale) throw new AppError("Sale not found", 404, "SALE_NOT_FOUND");
    if (sale.status === "CANCELLED") throw new AppError("Sale is already cancelled", 400, "SALE_ALREADY_CANCELLED");
    if (sale.version !== version) {
      throw new AppError("Sale has been modified. Refresh and try again.", 409, "VERSION_CONFLICT");
    }

    // If COMPLETED, reverse ledger entries (positive quantityChange to restore stock)
    if (sale.status === "COMPLETED") {
      for (const item of sale.items) {
        if (item.ledgerEntryId) {
          await tx.inventoryLedger.create({
            data: {
              tenantId,
              storeId: sale.storeId,
              productId: item.productId,
              batchNumber: item.batchNumber,
              expiryDate: item.expiryDate,
              transactionType: "ADJUSTMENT",
              quantityChange: item.quantity.toNumber(),
              referenceNumber: `CANCEL-${sale.saleNumber}`,
              notes: `Stock reversal for cancelled sale ${sale.saleNumber}`,
              createdBy: userId,
            },
          });
        }
      }
    }

    // Update sale status
    await tx.pharmacySale.update({
      where: { id: sale.id },
      data: {
        status: "CANCELLED",
        updatedBy: userId,
        version: { increment: 1 },
      },
    });

    createAuditLog({
      tenantId,
      performedBy: userId,
      entityType: "PHARMACY_SALE",
      entityId: sale.id,
      action: "UPDATE",
      oldValue: { status: sale.status },
      newValue: { status: "CANCELLED" },
    });

    return { success: true };
  });
}

// =====================================================
// HELPER: Map sale to detail response
// =====================================================

function mapSaleToDetail(
  sale: {
    id: string;
    saleNumber: string;
    patientId: string;
    visitId: string | null;
    storeId: string;
    saleType: string;
    status: PharmacySaleStatus;
    totalAmount: DecimalType;
    discount: DecimalType;
    tax: DecimalType;
    netAmount: DecimalType;
    creditAllowed: boolean;
    invoiceId: string | null;
    prescriptionId: string | null;
    version: number;
    createdBy: string;
    updatedBy: string;
    createdAt: Date;
    updatedAt: Date;
  },
  store: { id: string; name: string; code: string | null },
  patient: { id: string; firstName: string; lastName: string | null; uhid: string | null },
  items: Array<{
    id: string;
    productId: string;
    batchNumber: string;
    expiryDate: Date;
    quantity: DecimalType;
    unitPrice: DecimalType;
    discount: DecimalType;
    tax: DecimalType;
    total: DecimalType;
    ledgerEntryId: string | null;
  }>,
  productMap: Map<string, { id: string; name: string; code: string | null; genericName: string | null }>
): SaleDetail {
  return {
    id: sale.id,
    saleNumber: sale.saleNumber,
    patientId: sale.patientId,
    patientName: sale.patient.lastName ? `${sale.patient.firstName} ${sale.patient.lastName}` : sale.patient.firstName,
    uhid: patient.uhid ?? "",
    storeId: sale.storeId,
    storeName: store.name,
    storeCode: store.code ?? "",
    visitId: sale.visitId,
    prescriptionId: sale.prescriptionId,
    saleType: sale.saleType,
    status: sale.status,
    totalAmount: sale.totalAmount.toString(),
    discount: sale.discount.toString(),
    tax: sale.tax.toString(),
    netAmount: sale.netAmount.toString(),
    creditAllowed: sale.creditAllowed,
    invoiceId: sale.invoiceId,
    notes: null,
    version: sale.version,
    createdBy: sale.createdBy,
    updatedBy: sale.updatedBy,
    createdAt: sale.createdAt.toISOString(),
    updatedAt: sale.updatedAt.toISOString(),
    items: items.map((i) => {
      const p = productMap.get(i.productId);
      return {
        id: i.id,
        productId: i.productId,
        productCode: p?.code ?? "",
        productName: p?.name ?? "",
        genericName: p?.genericName ?? "",
        batchNumber: i.batchNumber,
        expiryDate: i.expiryDate.toISOString(),
        quantity: i.quantity.toString(),
        unitPrice: i.unitPrice.toString(),
        discount: i.discount.toString(),
        tax: i.tax.toString(),
        total: i.total.toString(),
      };
    }),
  };
}
