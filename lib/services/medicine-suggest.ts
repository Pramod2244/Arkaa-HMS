/**
 * Phase-3: Medicine Auto-suggest Service
 * 
 * Smart medicine search with prioritized results:
 * 1. Doctor's frequently used medicines
 * 2. Tenant-wide common medicines  
 * 3. Global medicine master
 * 
 * Features:
 * - Debounced search (300ms recommended on client)
 * - Max 10 suggestions per query
 * - Indexed search - NO full table scans
 */

import { prisma } from "@/lib/prisma";

// ============== TYPES ==============

export interface MedicineSuggestion {
  id: string;
  brandName: string;
  genericName: string | null;
  strength: string | null;
  dosageForm: string;
  route: string | null;
  defaultDosage: string | null;
  defaultFrequency: string | null;
  defaultDuration: string | null;
  defaultTiming: string | null;
  category: string | null;
  source: 'doctor_favorite' | 'tenant' | 'global';
  usageCount?: number;
}

// ============== MAIN SERVICE ==============

/**
 * Search medicines with prioritized results
 * 
 * Search priority:
 * 1. Doctor's frequently used (sorted by usageCount desc)
 * 2. Tenant medicines (sorted by brandName)
 * 3. Global medicines (sorted by brandName)
 * 
 * @param query - Search term (min 2 characters)
 * @param tenantId - Tenant ID for isolation
 * @param doctorId - Doctor user ID for favorites
 * @param limit - Max results (default 10)
 */
export async function searchMedicines(
  query: string,
  tenantId: string,
  doctorId: string,
  limit: number = 10
): Promise<MedicineSuggestion[]> {
  // Require at least 2 characters
  if (!query || query.length < 2) {
    return [];
  }

  const searchTerm = query.toLowerCase();
  const results: MedicineSuggestion[] = [];
  const seenIds = new Set<string>();

  // 1. Doctor's frequently used medicines (highest priority)
  const doctorFavorites = await prisma.doctorMedicineFavorite.findMany({
    where: {
      tenantId,
      doctorId,
      medicine: {
        OR: [
          { brandName: { contains: searchTerm, mode: 'insensitive' } },
          { genericName: { contains: searchTerm, mode: 'insensitive' } },
        ],
        isActive: true,
        isDeleted: false,
      },
    },
    include: {
      medicine: true,
    },
    orderBy: { usageCount: 'desc' },
    take: limit,
  });

  for (const fav of doctorFavorites) {
    if (results.length >= limit) break;
    if (seenIds.has(fav.medicine.id)) continue;
    
    seenIds.add(fav.medicine.id);
    results.push({
      id: fav.medicine.id,
      brandName: fav.medicine.brandName,
      genericName: fav.medicine.genericName,
      strength: fav.medicine.strength,
      dosageForm: fav.medicine.dosageForm,
      route: fav.medicine.route,
      // Use doctor's custom defaults if set, otherwise medicine defaults
      defaultDosage: fav.customDosage || fav.medicine.defaultDosage,
      defaultFrequency: fav.customFrequency || fav.medicine.defaultFrequency,
      defaultDuration: fav.customDuration || fav.medicine.defaultDuration,
      defaultTiming: fav.customTiming || fav.medicine.defaultTiming,
      category: fav.medicine.category,
      source: 'doctor_favorite',
      usageCount: fav.usageCount,
    });
  }

  // 2. Tenant medicines (if we need more results)
  if (results.length < limit) {
    const tenantMedicines = await prisma.medicine.findMany({
      where: {
        tenantId,
        OR: [
          { brandName: { contains: searchTerm, mode: 'insensitive' } },
          { genericName: { contains: searchTerm, mode: 'insensitive' } },
        ],
        isActive: true,
        isDeleted: false,
      },
      orderBy: { brandName: 'asc' },
      take: limit - results.length,
    });

    for (const med of tenantMedicines) {
      if (results.length >= limit) break;
      if (seenIds.has(med.id)) continue;
      
      seenIds.add(med.id);
      results.push({
        id: med.id,
        brandName: med.brandName,
        genericName: med.genericName,
        strength: med.strength,
        dosageForm: med.dosageForm,
        route: med.route,
        defaultDosage: med.defaultDosage,
        defaultFrequency: med.defaultFrequency,
        defaultDuration: med.defaultDuration,
        defaultTiming: med.defaultTiming,
        category: med.category,
        source: 'tenant',
      });
    }
  }

  // 3. Global medicines (if we still need more results)
  if (results.length < limit) {
    const globalMedicines = await prisma.medicine.findMany({
      where: {
        tenantId: null,
        OR: [
          { brandName: { contains: searchTerm, mode: 'insensitive' } },
          { genericName: { contains: searchTerm, mode: 'insensitive' } },
        ],
        isActive: true,
        isDeleted: false,
      },
      orderBy: { brandName: 'asc' },
      take: limit - results.length,
    });

    for (const med of globalMedicines) {
      if (results.length >= limit) break;
      if (seenIds.has(med.id)) continue;
      
      seenIds.add(med.id);
      results.push({
        id: med.id,
        brandName: med.brandName,
        genericName: med.genericName,
        strength: med.strength,
        dosageForm: med.dosageForm,
        route: med.route,
        defaultDosage: med.defaultDosage,
        defaultFrequency: med.defaultFrequency,
        defaultDuration: med.defaultDuration,
        defaultTiming: med.defaultTiming,
        category: med.category,
        source: 'global',
      });
    }
  }

  return results;
}

/**
 * Get doctor's top used medicines (for quick selection)
 */
export async function getDoctorTopMedicines(
  tenantId: string,
  doctorId: string,
  limit: number = 10
): Promise<MedicineSuggestion[]> {
  const favorites = await prisma.doctorMedicineFavorite.findMany({
    where: {
      tenantId,
      doctorId,
      medicine: {
        isActive: true,
        isDeleted: false,
      },
    },
    include: {
      medicine: true,
    },
    orderBy: { usageCount: 'desc' },
    take: limit,
  });

  return favorites.map(fav => ({
    id: fav.medicine.id,
    brandName: fav.medicine.brandName,
    genericName: fav.medicine.genericName,
    strength: fav.medicine.strength,
    dosageForm: fav.medicine.dosageForm,
    route: fav.medicine.route,
    defaultDosage: fav.customDosage || fav.medicine.defaultDosage,
    defaultFrequency: fav.customFrequency || fav.medicine.defaultFrequency,
    defaultDuration: fav.customDuration || fav.medicine.defaultDuration,
    defaultTiming: fav.customTiming || fav.medicine.defaultTiming,
    category: fav.medicine.category,
    source: 'doctor_favorite' as const,
    usageCount: fav.usageCount,
  }));
}

// ============== LAB TEST SEARCH ==============

export interface LabTestSuggestion {
  id: string;
  testCode: string;
  testName: string;
  shortName: string | null;
  category: string | null;
  sampleType: string | null;
  turnaroundTime: string | null;
  source: 'tenant' | 'global';
}

/**
 * Search lab tests
 */
export async function searchLabTests(
  query: string,
  tenantId: string,
  limit: number = 10
): Promise<LabTestSuggestion[]> {
  if (!query || query.length < 2) {
    return [];
  }

  const searchTerm = query.toLowerCase();
  const results: LabTestSuggestion[] = [];
  const seenIds = new Set<string>();

  // 1. Tenant lab tests
  const tenantTests = await prisma.labTest.findMany({
    where: {
      tenantId,
      OR: [
        { testName: { contains: searchTerm, mode: 'insensitive' } },
        { testCode: { contains: searchTerm, mode: 'insensitive' } },
        { shortName: { contains: searchTerm, mode: 'insensitive' } },
      ],
      isActive: true,
      isDeleted: false,
    },
    orderBy: { testName: 'asc' },
    take: limit,
  });

  for (const test of tenantTests) {
    if (results.length >= limit) break;
    seenIds.add(test.id);
    results.push({
      id: test.id,
      testCode: test.testCode,
      testName: test.testName,
      shortName: test.shortName,
      category: test.category,
      sampleType: test.sampleType,
      turnaroundTime: test.turnaroundTime,
      source: 'tenant',
    });
  }

  // 2. Global lab tests
  if (results.length < limit) {
    const globalTests = await prisma.labTest.findMany({
      where: {
        tenantId: null,
        OR: [
          { testName: { contains: searchTerm, mode: 'insensitive' } },
          { testCode: { contains: searchTerm, mode: 'insensitive' } },
          { shortName: { contains: searchTerm, mode: 'insensitive' } },
        ],
        isActive: true,
        isDeleted: false,
      },
      orderBy: { testName: 'asc' },
      take: limit - results.length,
    });

    for (const test of globalTests) {
      if (results.length >= limit) break;
      if (seenIds.has(test.id)) continue;
      
      results.push({
        id: test.id,
        testCode: test.testCode,
        testName: test.testName,
        shortName: test.shortName,
        category: test.category,
        sampleType: test.sampleType,
        turnaroundTime: test.turnaroundTime,
        source: 'global',
      });
    }
  }

  return results;
}

/**
 * Get common lab test categories
 */
export async function getLabTestCategories(
  tenantId: string
): Promise<string[]> {
  const results = await prisma.labTest.findMany({
    where: {
      OR: [
        { tenantId },
        { tenantId: null },
      ],
      isActive: true,
      isDeleted: false,
      category: { not: null },
    },
    select: { category: true },
    distinct: ['category'],
  });

  return results
    .map(r => r.category)
    .filter((c): c is string => c !== null)
    .sort();
}
