import { prisma } from "@/lib/prisma";
import { AppError } from "@/lib/rbac";
import { createAuditLog } from "@/lib/audit";
import type { Prisma, PharmacySaleStatus } from "@/app/generated/prisma/client";
import { Prisma as PrismaNamespace } from "@/app/generated/prisma/client";
import { allocateStockFIFO } from "./stock-allocation.service";

const Decimal = PrismaNamespace.Decimal;

// =====================================================
// TYPES
// =====================================================

interface IPSaleItemInput {
  productId: string;
  quantity: number;
  discount?: number;
}

interface CreateIPSaleInput {
  patientId: string;
  storeId: string;
  admissionId?: string;
  visitId?: string;
  invoiceId?: string;
  prescriptionId?: string;
  notes?: string;
  items: IPSaleItemInput[];
}

interface IPSaleItemResponse {
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

interface IPSaleListItem {
  id: string;
  saleNumber: string;
  patientId: string;
  patientName: string;
  uhid: string;
  storeId: string;
  storeName: string;
  admissionId: string | null;
  status: PharmacySaleStatus;
  totalAmount: string;
  discount: string;
  netAmount: string;
  itemCount: number;
  createdAt: string;
  updatedAt: string;
}

interface IPSaleDetail {
  id: string;
  saleNumber: string;
  patientId: string;
  patientName: string;
  uhid: string;
  storeId: string;
  storeName: string;
  storeCode: string;
  admissionId: string | null;
  visitId: string | null;
  invoiceId: string | null;
  prescriptionId: string | null;
  saleType: string;
  status: PharmacySaleStatus;
  totalAmount: string;
  discount: string;
  tax: string;
  netAmount: string;
  version: number;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
  items: IPSaleItemResponse[];
}

interface CursorResult<T> {
  data: T[];
  pagination: { cursor: string | null; hasMore: boolean };
}

interface IPSaleQueryOptions {
  search?: string;
  status?: string;
  storeId?: string;
  patientId?: string;
  admissionId?: string;
  cursor?: string;
  limit?: number;
}

// =====================================================
// IP SALE NUMBER GENERATOR
// =====================================================

async function generateIPSaleNumber(
  tenantId: string,
  tx: Prisma.TransactionClient
): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `IPS-${year}-`;

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
// CREATE IP SALE
// Enterprise flow: Sale → FIFO Allocate → Ledger (OUT) → Attach to Invoice
// =====================================================

export async function createIPSale(
  tenantId: string,
  userId: string,
  input: CreateIPSaleInput
): Promise<IPSaleDetail> {
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

    // 3. Validate existing invoice (if provided, attach items to it)
    let existingInvoice: { id: string; subtotal: number; discount: number; tax: number; total: number; outstanding: number } | null = null;
    if (input.invoiceId) {
      existingInvoice = await tx.invoice.findFirst({
        where: { id: input.invoiceId, tenantId },
        select: { id: true, subtotal: true, discount: true, tax: true, total: true, outstanding: true },
      });
      if (!existingInvoice) throw new AppError("Invoice not found", 404, "INVOICE_NOT_FOUND");
    }

    // 4. Validate prescription (if linked) - narcotic check
    let prescriptionDoctorId: string | null = null;
    if (input.prescriptionId) {
      const prescription = await tx.prescription.findFirst({
        where: { id: input.prescriptionId, tenantId, status: "ACTIVE" },
        select: { id: true, doctorId: true },
      });
      if (!prescription) throw new AppError("Prescription not found or cancelled", 404, "PRESCRIPTION_NOT_FOUND");
      prescriptionDoctorId = prescription.doctorId;
    }

    // 5. Validate & fetch products
    const productIds = [...new Set(input.items.map((i) => i.productId))];
    const products = await tx.product.findMany({
      where: { id: { in: productIds }, tenantId, isDeleted: false, status: "ACTIVE" },
      select: { id: true, name: true, code: true, genericName: true, mrp: true, isNarcotic: true },
    });
    const productMap = new Map(products.map((p) => [p.id, p]));

    for (const item of input.items) {
      const product = productMap.get(item.productId);
      if (!product) throw new AppError(`Product ${item.productId} not found or inactive`, 404, "PRODUCT_NOT_FOUND");

      if (product.isNarcotic && !prescriptionDoctorId) {
        throw new AppError(
          `Product "${product.name}" is a controlled substance. A valid prescription is required.`,
          400,
          "NARCOTIC_REQUIRES_PRESCRIPTION"
        );
      }
    }

    // 6. Generate sale number
    const saleNumber = await generateIPSaleNumber(tenantId, tx);

    // 7. Calculate totals
    let totalAmount = new Decimal(0);
    let totalDiscount = new Decimal(0);

    for (const item of input.items) {
      const product = productMap.get(item.productId)!;
      const lineTotal = new Decimal((product.mrp ?? 0).toString()).mul(item.quantity);
      const lineDiscount = new Decimal(item.discount ?? 0);
      totalAmount = totalAmount.add(lineTotal);
      totalDiscount = totalDiscount.add(lineDiscount.mul(item.quantity));
    }

    const tax = new Decimal(0);
    const netAmount = totalAmount.sub(totalDiscount).add(tax);

    // 8. Create PharmacySale (IP sales are always COMPLETED immediately)
    const sale = await tx.pharmacySale.create({
      data: {
        tenantId,
        saleNumber,
        patientId: input.patientId,
        visitId: input.visitId ?? null,
        admissionId: input.admissionId ?? null,
        storeId: input.storeId,
        saleType: "IP",
        status: "COMPLETED",
        totalAmount,
        discount: totalDiscount,
        tax,
        netAmount,
        creditAllowed: false,
        prescriptionId: input.prescriptionId ?? null,
        invoiceId: input.invoiceId ?? null,
        createdBy: userId,
        updatedBy: userId,
      },
    });

    // 9. FIFO allocate & create sale items
    const saleItems: IPSaleItemResponse[] = [];

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
          productCode: product.code ?? "",
          productName: product.name,
          genericName: product.genericName ?? "",
          batchNumber: batch.batchNumber,
          expiryDate: (batch.expiryDate ?? new Date("2099-12-31")).toISOString(),
          quantity: batch.allocatedQty.toString(),
          unitPrice: lineUnitPrice.toString(),
          discount: lineDiscount.mul(batch.allocatedQty).toString(),
          tax: lineTax.toString(),
          total: lineTotal.toString(),
        });
      }

      // Mark prescription items as dispensed
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

    // 10. Attach items to existing Invoice (if provided)
    if (existingInvoice) {
      for (const si of saleItems) {
        const product = productMap.get(si.productId)!;
        await tx.invoiceItem.create({
          data: {
            tenantId,
            invoiceId: existingInvoice.id,
            itemType: "MEDICINE",
            itemId: sale.id,
            description: `${product.name} (Batch: ${si.batchNumber})`,
            quantity: Number(si.quantity),
            unitPrice: Number(si.unitPrice),
            discount: Number(si.discount),
            total: Number(si.total),
          },
        });
      }

      // Update invoice totals
      await tx.invoice.update({
        where: { id: existingInvoice.id },
        data: {
          subtotal: existingInvoice.subtotal + netAmount.toNumber(),
          total: existingInvoice.total + netAmount.toNumber(),
          outstanding: existingInvoice.outstanding + netAmount.toNumber(),
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
      newValue: {
        saleNumber,
        saleType: "IP",
        admissionId: input.admissionId,
        netAmount: netAmount.toString(),
      },
    });

    return {
      id: sale.id,
      saleNumber: sale.saleNumber,
      patientId: sale.patientId,
      patientName: `${patient.firstName} ${patient.lastName}`,
      uhid: patient.uhid ?? "",
      storeId: sale.storeId,
      storeName: store.name,
      storeCode: store.code ?? "",
      admissionId: sale.admissionId,
      visitId: sale.visitId,
      invoiceId: sale.invoiceId,
      prescriptionId: sale.prescriptionId,
      saleType: sale.saleType,
      status: sale.status,
      totalAmount: sale.totalAmount.toString(),
      discount: sale.discount.toString(),
      tax: sale.tax.toString(),
      netAmount: sale.netAmount.toString(),
      version: sale.version,
      createdBy: sale.createdBy,
      updatedBy: sale.updatedBy,
      createdAt: sale.createdAt.toISOString(),
      updatedAt: sale.updatedAt.toISOString(),
      items: saleItems,
    };
  });
}

// =====================================================
// GET IP SALES (cursor pagination)
// =====================================================

export async function getIPSalesCursor(
  tenantId: string,
  options: IPSaleQueryOptions
): Promise<CursorResult<IPSaleListItem>> {
  const limit = options.limit ?? 20;
  const where: Prisma.PharmacySaleWhereInput = {
    tenantId,
    isDeleted: false,
    saleType: "IP",
  };

  if (options.search) {
    where.OR = [
      { saleNumber: { contains: options.search, mode: "insensitive" } },
      { patient: { firstName: { contains: options.search, mode: "insensitive" } } },
      { patient: { lastName: { contains: options.search, mode: "insensitive" } } },
      { patient: { uhid: { contains: options.search, mode: "insensitive" } } },
    ];
  }

  if (options.status) where.status = options.status as PharmacySaleStatus;
  if (options.storeId) where.storeId = options.storeId;
  if (options.patientId) where.patientId = options.patientId;
  if (options.admissionId) where.admissionId = options.admissionId;

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
      admissionId: true,
      status: true,
      totalAmount: true,
      discount: true,
      netAmount: true,
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
        patient: { firstName: string; lastName: string; uhid: string | null };
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
        admissionId: rec.admissionId,
        status: rec.status,
        totalAmount: rec.totalAmount.toString(),
        discount: rec.discount.toString(),
        netAmount: rec.netAmount.toString(),
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
// GET IP SALE DETAIL BY ID
// =====================================================

export async function getIPSaleById(
  tenantId: string,
  saleId: string
): Promise<IPSaleDetail> {
  const sale = await prisma.pharmacySale.findFirst({
    where: { id: saleId, tenantId, isDeleted: false, saleType: "IP" },
    include: {
      patient: { select: { id: true, firstName: true, lastName: true, uhid: true } },
      store: { select: { id: true, name: true, code: true } },
      items: {
        where: { isDeleted: false },
        include: {
          product: { select: { id: true, name: true, code: true, genericName: true } },
        },
      },
    },
  });

  if (!sale) throw new AppError("IP Sale not found", 404, "SALE_NOT_FOUND");

  return {
    id: sale.id,
    saleNumber: sale.saleNumber,
    patientId: sale.patientId,
    patientName: sale.patient.lastName ? `${sale.patient.firstName} ${sale.patient.lastName}` : sale.patient.firstName,
    uhid: sale.patient.uhid ?? "",
    storeId: sale.storeId,
    storeName: sale.store.name,
    storeCode: sale.store.code ?? "",
    admissionId: sale.admissionId,
    visitId: sale.visitId,
    invoiceId: sale.invoiceId,
    prescriptionId: sale.prescriptionId,
    saleType: sale.saleType,
    status: sale.status,
    totalAmount: sale.totalAmount.toString(),
    discount: sale.discount.toString(),
    tax: sale.tax.toString(),
    netAmount: sale.netAmount.toString(),
    version: sale.version,
    createdBy: sale.createdBy,
    updatedBy: sale.updatedBy,
    createdAt: sale.createdAt.toISOString(),
    updatedAt: sale.updatedAt.toISOString(),
    items: sale.items.map((i) => ({
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
    })),
  };
}
