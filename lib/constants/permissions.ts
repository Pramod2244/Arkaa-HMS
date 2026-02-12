/**
 * HMS OPD-Specific Permissions
 * These permissions control access to OPD workflows and operations
 */

export const OPD_PERMISSIONS = {
  // OPD Visit Management
  OPD_VIEW: "OPD_VIEW", // View OPD visits (reception, doctor, admin)
  OPD_CREATE: "OPD_CREATE", // Create new OPD visits (reception, admin)
  OPD_UPDATE: "OPD_UPDATE", // Update OPD visit details (admin)
  OPD_DELETE: "OPD_DELETE", // Delete OPD visits (admin only)

  // OPD Check-in
  OPD_CHECKIN: "OPD_CHECKIN", // Check-in patient to OPD (reception)

  // Doctor Queue Access
  DOCTOR_QUEUE_VIEW: "DOCTOR_QUEUE_VIEW", // View doctor's OPD queue (doctor)

  // OPD Consultation
  OPD_CONSULTATION_CREATE: "OPD_CONSULTATION_CREATE", // Start OPD consultation (doctor)
  OPD_CONSULTATION_VIEW: "OPD_CONSULTATION_VIEW", // View consultations (doctor, admin)
  OPD_CONSULTATION_UPDATE: "OPD_CONSULTATION_UPDATE", // Update consultation (doctor)
  OPD_CONSULTATION_FINALIZE: "OPD_CONSULTATION_FINALIZE", // Mark consultation complete (doctor)

  // OPD Vitals
  OPD_VITALS_RECORD: "OPD_VITALS_RECORD", // Record patient vitals (nurse, doctor)
  OPD_VITALS_VIEW: "OPD_VITALS_VIEW", // View patient vitals (doctor, admin)

  // OPD Prescriptions
  OPD_PRESCRIPTION_CREATE: "OPD_PRESCRIPTION_CREATE", // Create prescription (doctor)
  OPD_PRESCRIPTION_VIEW: "OPD_PRESCRIPTION_VIEW", // View prescriptions (doctor, pharmacy)
  OPD_PRESCRIPTION_DISPENSE: "OPD_PRESCRIPTION_DISPENSE", // Dispense medicine (pharmacy)

  // OPD Lab Orders
  OPD_LAB_ORDER_CREATE: "OPD_LAB_ORDER_CREATE", // Create lab order (doctor)
  OPD_LAB_ORDER_VIEW: "OPD_LAB_ORDER_VIEW", // View lab orders (doctor, lab)
  OPD_LAB_RESULT_UPLOAD: "OPD_LAB_RESULT_UPLOAD", // Upload lab results (lab)

  // OPD Billing
  OPD_INVOICE_CREATE: "OPD_INVOICE_CREATE", // Create invoice (billing)
  OPD_INVOICE_VIEW: "OPD_INVOICE_VIEW", // View invoices (billing, admin)
  OPD_PAYMENT_RECORD: "OPD_PAYMENT_RECORD", // Record payment (billing)

  // OPD Reporting
  OPD_REPORTS_VIEW: "OPD_REPORTS_VIEW", // View OPD reports/analytics (admin)
} as const;

/**
 * Doctor Availability Permissions
 * Permissions for managing doctor schedules and availability
 */
export const AVAILABILITY_PERMISSIONS = {
  // View availability schedules
  AVAILABILITY_VIEW: "AVAILABILITY_VIEW",
  // Create new availability slots
  AVAILABILITY_CREATE: "AVAILABILITY_CREATE",
  // Update existing availability
  AVAILABILITY_UPDATE: "AVAILABILITY_UPDATE",
  // Delete availability slots
  AVAILABILITY_DELETE: "AVAILABILITY_DELETE",
} as const;

/**
 * Appointment Booking Permissions
 * Permissions for appointment management
 */
export const APPOINTMENT_PERMISSIONS = {
  // View appointments
  APPOINTMENT_VIEW: "APPOINTMENT_VIEW",
  // Create new appointments (book)
  APPOINTMENT_CREATE: "APPOINTMENT_CREATE",
  // Update appointment details
  APPOINTMENT_UPDATE: "APPOINTMENT_UPDATE",
  // Cancel appointments
  APPOINTMENT_CANCEL: "APPOINTMENT_CANCEL",
  // Reschedule appointments
  APPOINTMENT_RESCHEDULE: "APPOINTMENT_RESCHEDULE",
  // Check-in patients
  APPOINTMENT_CHECKIN: "APPOINTMENT_CHECKIN",
  // View appointment slots
  APPOINTMENT_SLOTS_VIEW: "APPOINTMENT_SLOTS_VIEW",
} as const;

/**
 * Medical Master Permissions
 * Permissions for managing medical masters (Doctors, Departments, etc.)
 */
export const MASTER_PERMISSIONS = {
  // Doctor Master
  DOCTOR_VIEW: "DOCTOR_VIEW", // View doctor profiles
  DOCTOR_CREATE: "DOCTOR_CREATE", // Create new doctor
  DOCTOR_EDIT: "DOCTOR_EDIT", // Edit doctor details
  DOCTOR_DISABLE: "DOCTOR_DISABLE", // Disable/soft-delete doctor
  DOCTOR_SCHEDULE_MANAGE: "DOCTOR_SCHEDULE_MANAGE", // Manage doctor schedules

  // Department Master (read-only for tenants, system-seeded)
  DEPARTMENT_VIEW: "DEPARTMENT_VIEW", // View departments
  DEPARTMENT_EDIT: "DEPARTMENT_EDIT", // Edit department (description, status only)

  // Future masters
  // MEDICINE_VIEW, MEDICINE_CREATE, etc.
  // LAB_TEST_VIEW, LAB_TEST_CREATE, etc.
} as const;

/**
 * Role-Permission Mappings for OPD
 * Maps user roles to their OPD permissions
 */
export const OPD_ROLE_PERMISSIONS: Record<string, string[]> = {
  // Reception Staff
  RECEPTIONIST: [
    OPD_PERMISSIONS.OPD_VIEW,
    OPD_PERMISSIONS.OPD_CREATE,
    OPD_PERMISSIONS.OPD_CHECKIN,
    OPD_PERMISSIONS.OPD_CONSULTATION_VIEW,
    OPD_PERMISSIONS.OPD_PRESCRIPTION_VIEW,
    // Appointment permissions
    APPOINTMENT_PERMISSIONS.APPOINTMENT_VIEW,
    APPOINTMENT_PERMISSIONS.APPOINTMENT_CREATE,
    APPOINTMENT_PERMISSIONS.APPOINTMENT_CANCEL,
    APPOINTMENT_PERMISSIONS.APPOINTMENT_RESCHEDULE,
    APPOINTMENT_PERMISSIONS.APPOINTMENT_CHECKIN,
    APPOINTMENT_PERMISSIONS.APPOINTMENT_SLOTS_VIEW,
    // Availability view only
    AVAILABILITY_PERMISSIONS.AVAILABILITY_VIEW,
  ],

  // Doctor
  DOCTOR: [
    OPD_PERMISSIONS.OPD_VIEW,
    OPD_PERMISSIONS.OPD_CONSULTATION_CREATE,
    OPD_PERMISSIONS.OPD_CONSULTATION_VIEW,
    OPD_PERMISSIONS.OPD_CONSULTATION_UPDATE,
    OPD_PERMISSIONS.OPD_CONSULTATION_FINALIZE,
    OPD_PERMISSIONS.DOCTOR_QUEUE_VIEW,
    OPD_PERMISSIONS.OPD_VITALS_RECORD,
    OPD_PERMISSIONS.OPD_VITALS_VIEW,
    OPD_PERMISSIONS.OPD_PRESCRIPTION_CREATE,
    OPD_PERMISSIONS.OPD_PRESCRIPTION_VIEW,
    OPD_PERMISSIONS.OPD_LAB_ORDER_CREATE,
    OPD_PERMISSIONS.OPD_LAB_ORDER_VIEW,
    // Appointment permissions
    APPOINTMENT_PERMISSIONS.APPOINTMENT_VIEW,
    APPOINTMENT_PERMISSIONS.APPOINTMENT_UPDATE,
    APPOINTMENT_PERMISSIONS.APPOINTMENT_SLOTS_VIEW,
    // Availability - doctors can manage their own availability
    AVAILABILITY_PERMISSIONS.AVAILABILITY_VIEW,
    AVAILABILITY_PERMISSIONS.AVAILABILITY_CREATE,
    AVAILABILITY_PERMISSIONS.AVAILABILITY_UPDATE,
  ],

  // Nurse
  NURSE: [
    OPD_PERMISSIONS.OPD_VIEW,
    OPD_PERMISSIONS.OPD_VITALS_RECORD,
    OPD_PERMISSIONS.OPD_VITALS_VIEW,
    OPD_PERMISSIONS.OPD_CONSULTATION_VIEW,
  ],

  // Lab Technician
  LAB_TECH: [
    OPD_PERMISSIONS.OPD_LAB_ORDER_VIEW,
    OPD_PERMISSIONS.OPD_LAB_RESULT_UPLOAD,
    OPD_PERMISSIONS.OPD_CONSULTATION_VIEW,
  ],

  // Pharmacist
  PHARMACIST: [
    OPD_PERMISSIONS.OPD_PRESCRIPTION_VIEW,
    OPD_PERMISSIONS.OPD_PRESCRIPTION_DISPENSE,
    OPD_PERMISSIONS.OPD_CONSULTATION_VIEW,
  ],

  // Billing Staff
  BILLING: [
    OPD_PERMISSIONS.OPD_INVOICE_CREATE,
    OPD_PERMISSIONS.OPD_INVOICE_VIEW,
    OPD_PERMISSIONS.OPD_PAYMENT_RECORD,
    OPD_PERMISSIONS.OPD_CONSULTATION_VIEW,
    // Appointment view only
    APPOINTMENT_PERMISSIONS.APPOINTMENT_VIEW,
  ],

  // Admin (Super User)
  ADMIN: [
    ...Object.values(OPD_PERMISSIONS),
    ...Object.values(AVAILABILITY_PERMISSIONS),
    ...Object.values(APPOINTMENT_PERMISSIONS),
  ],
};

/**
 * OPD Status Workflow
 * Defines valid state transitions for OPD visits
 */
export const OPD_VISIT_STATES = {
  WAITING: "WAITING", // Patient checked-in, waiting for doctor
  IN_PROGRESS: "IN_PROGRESS", // Doctor is consulting
  COMPLETED: "COMPLETED", // Consultation complete
  CANCELLED: "CANCELLED", // Visit cancelled
  TRANSFERRED: "TRANSFERRED", // Transferred to IPD/other dept
} as const;

/**
 * OPD Priority Levels
 * Used for queue management
 */
export const OPD_PRIORITY_LEVELS = {
  EMERGENCY: "EMERGENCY", // Life-threatening, seen immediately
  URGENT: "URGENT", // Serious condition, high priority
  NORMAL: "NORMAL", // Standard priority
  LOW: "LOW", // Can wait
} as const;

/**
 * Department-Wise Access Control
 * Ensures users only see data for their assigned departments
 */
export const DEPARTMENT_ACCESS_RULES = {
  // User can only create OPD visits in their assigned departments
  CREATE_VISIT_IN_OWN_DEPT: true,

  // User can only view visits from their assigned departments
  VIEW_VISITS_IN_OWN_DEPT: true,

  // Doctor assignment must be from the same department
  DOCTOR_SAME_DEPT: true,

  // Users cannot reassign visits to other departments
  NO_CROSS_DEPT_TRANSFER: true,
} as const;
