/**
 * HMS Medical Masters - Global Department Definitions
 * 
 * Predefined list of medical departments used worldwide.
 * These are SYSTEM DEPARTMENTS and should be seeded for each tenant.
 * 
 * RULES:
 * - Departments are GLOBAL MEDICAL STANDARDS
 * - Code format: DEPT_<UPPERCASE_NAME>
 * - Admin can only ACTIVATE/DEACTIVATE and edit description
 * - Cannot create, delete, or change code/name
 */

export interface SystemDepartment {
  code: string;
  name: string;
  description: string;
}

/**
 * Predefined global department catalog
 * These departments follow international medical standards
 */
export const SYSTEM_DEPARTMENTS: SystemDepartment[] = [
  {
    code: "DEPT_GENERAL_MEDICINE",
    name: "General Medicine",
    description: "Primary care and internal medicine for adult patients",
  },
  {
    code: "DEPT_GENERAL_SURGERY",
    name: "General Surgery",
    description: "Surgical procedures for abdominal, soft tissue, and skin conditions",
  },
  {
    code: "DEPT_CARDIOLOGY",
    name: "Cardiology",
    description: "Heart and cardiovascular system diagnosis and treatment",
  },
  {
    code: "DEPT_NEUROLOGY",
    name: "Neurology",
    description: "Brain, spinal cord, and nervous system disorders",
  },
  {
    code: "DEPT_ORTHOPEDICS",
    name: "Orthopedics",
    description: "Musculoskeletal system including bones, joints, and muscles",
  },
  {
    code: "DEPT_PEDIATRICS",
    name: "Pediatrics",
    description: "Medical care for infants, children, and adolescents",
  },
  {
    code: "DEPT_OBSTETRICS_GYNECOLOGY",
    name: "Obstetrics & Gynecology",
    description: "Women's reproductive health, pregnancy, and childbirth",
  },
  {
    code: "DEPT_DERMATOLOGY",
    name: "Dermatology",
    description: "Skin, hair, and nail conditions and diseases",
  },
  {
    code: "DEPT_ENT",
    name: "ENT (Otorhinolaryngology)",
    description: "Ear, nose, throat, and related head/neck structures",
  },
  {
    code: "DEPT_OPHTHALMOLOGY",
    name: "Ophthalmology",
    description: "Eye and vision care, diagnosis and surgery",
  },
  {
    code: "DEPT_PSYCHIATRY",
    name: "Psychiatry",
    description: "Mental health disorders and behavioral conditions",
  },
  {
    code: "DEPT_RADIOLOGY",
    name: "Radiology",
    description: "Medical imaging including X-ray, CT, MRI, and ultrasound",
  },
  {
    code: "DEPT_ANESTHESIOLOGY",
    name: "Anesthesiology",
    description: "Anesthesia and pain management for surgical procedures",
  },
  {
    code: "DEPT_EMERGENCY",
    name: "Emergency Medicine",
    description: "Acute illness and injury requiring immediate medical attention",
  },
  {
    code: "DEPT_PULMONOLOGY",
    name: "Pulmonology",
    description: "Respiratory system and lung diseases",
  },
  {
    code: "DEPT_GASTROENTEROLOGY",
    name: "Gastroenterology",
    description: "Digestive system including stomach, intestines, and liver",
  },
  {
    code: "DEPT_NEPHROLOGY",
    name: "Nephrology",
    description: "Kidney function and renal diseases",
  },
  {
    code: "DEPT_UROLOGY",
    name: "Urology",
    description: "Urinary tract and male reproductive system",
  },
  {
    code: "DEPT_ONCOLOGY",
    name: "Oncology",
    description: "Cancer diagnosis, treatment, and care",
  },
  {
    code: "DEPT_ENDOCRINOLOGY",
    name: "Endocrinology",
    description: "Hormonal and metabolic disorders including diabetes",
  },
  {
    code: "DEPT_RHEUMATOLOGY",
    name: "Rheumatology",
    description: "Autoimmune diseases and joint disorders",
  },
  {
    code: "DEPT_INFECTIOUS_DISEASES",
    name: "Infectious Diseases",
    description: "Bacterial, viral, fungal, and parasitic infections",
  },
  {
    code: "DEPT_DENTISTRY",
    name: "Dentistry",
    description: "Oral health, teeth, gums, and dental procedures",
  },
  {
    code: "DEPT_PHYSIOTHERAPY",
    name: "Physiotherapy",
    description: "Physical rehabilitation and movement therapy",
  },
  {
    code: "DEPT_PATHOLOGY",
    name: "Pathology",
    description: "Laboratory analysis of tissues, blood, and body fluids",
  },
  {
    code: "DEPT_PLASTIC_SURGERY",
    name: "Plastic Surgery",
    description: "Reconstructive and cosmetic surgical procedures",
  },
  {
    code: "DEPT_VASCULAR_SURGERY",
    name: "Vascular Surgery",
    description: "Blood vessel and circulatory system surgical procedures",
  },
  {
    code: "DEPT_NEONATOLOGY",
    name: "Neonatology",
    description: "Specialized care for newborn infants, especially premature",
  },
  {
    code: "DEPT_GERIATRICS",
    name: "Geriatrics",
    description: "Healthcare for elderly patients and age-related conditions",
  },
  {
    code: "DEPT_PALLIATIVE_CARE",
    name: "Palliative Care",
    description: "Comfort care and symptom management for serious illness",
  },
];

/**
 * Get department by code
 */
export function getSystemDepartmentByCode(code: string): SystemDepartment | undefined {
  return SYSTEM_DEPARTMENTS.find(d => d.code === code);
}

/**
 * Get all department codes
 */
export function getSystemDepartmentCodes(): string[] {
  return SYSTEM_DEPARTMENTS.map(d => d.code);
}
