# HMS Cloud - Database Summary

## 📊 Overview
**Multi-tenant Hospital Management System** built with PostgreSQL and Prisma ORM
- **Total Tables**: 23 core tables
- **Tenant Isolation**: All data filtered by `tenantId`
- **Audit Support**: Change tracking on all entities
- **Soft Deletes**: Via `isActive` flags

---

## 🏢 MULTI-TENANT CORE (4 tables)

### 1. **Tenant**
- Platform organizations (Hospital/Clinic)
- Fields: `id`, `name`, `code` (unique), `type`, `contact`, `isActive`, `timestamps`
- Relations: licenses, settings, users, roles, departments, patients, audit logs
- **Sample Data**: DEMO tenant

### 2. **TenantLicense**
- Subscription/licensing per tenant
- Fields: `tenantId`, `plan` (BASIC/PRO/ENTERPRISE), `maxUsers`, `startDate`, `endDate`, `isActive`
- Enforces license expiry at login
- **Sample Data**: PRO plan, 50 users, valid for 1 year

### 3. **TenantSetting**
- Key-value configuration store per tenant
- Fields: `tenantId`, `key`, `value` (JSON)
- Used for customizable settings

### 4. **AuditLog**
- Compliance & change tracking
- Fields: `tenantId`, `performedBy` (userId), `entityType`, `entityId`, `action` (CREATE/UPDATE/DELETE), `oldValue`, `newValue`, `performedAt`
- Tracks all user modifications

---

## 🔐 RBAC (5 tables)

### 5. **User**
- Staff members (staff/doctors/nurses/receptionists)
- Fields: `id`, `tenantId`, `email`, `username`, `passwordHash`, `fullName`, `mobile`, `isActive`, `isSuperAdmin`, `timestamps`
- Relationships: userRoles, auditLogs, doctorAppointments, doctorConsultations, doctorPrescriptions
- **Sample Data**: admin@demo.com / admin123

### 6. **Role**
- Permission groups (ADMIN, DOCTOR, RECEPTIONIST, LAB_TECH, BILLING)
- Fields: `tenantId`, `code`, `name`, `description`, `isSystem`, `timestamps`
- **System Roles**: ADMIN (all permissions), DOCTOR, RECEPTIONIST, LAB_TECH, BILLING, ACCOUNTANT

### 7. **Permission**
- Fine-grained access controls
- Fields: `code` (unique), `name`, `module`, `description`, `timestamps`
- **Sample Permissions**: PATIENT_VIEW, PATIENT_CREATE, APPOINTMENT_VIEW, CONSULTATION_CREATE, etc.

### 8. **RolePermission** (Junction)
- Maps roles to permissions (many-to-many)
- Fields: `roleId`, `permissionId`
- Composite key: `[roleId, permissionId]`

### 9. **UserRole** (Junction)
- Maps users to roles (many-to-many)
- Fields: `userId`, `roleId`
- Composite key: `[userId, roleId]`

---

## 🏥 CORE ENTITIES

### 10. **Department**
- Hospital/clinic departments
- Fields: `tenantId`, `name`, `code`, `isActive`, `timestamps`
- Relations: staff assignments, appointments, visits

### 11. **Patient**
- Patient master records
- Fields: `tenantId`, `uhid` (Unique Hospital ID per tenant), `firstName`, `lastName`, `gender` (MALE/FEMALE/OTHER), `dateOfBirth`, `phoneNumber`, `email`, `address`
- Emergency Contact: `emergencyContactName`, `emergencyContactPhone`
- Medical Info: `bloodGroup` (A+/A-/B+/B-/AB+/AB-/O+/O-), `allergies`, `medicalHistory`
- Status: ACTIVE/INACTIVE/DECEASED
- Relations: appointments, visits, prescriptions, labOrders, invoices, payments

---

## 📅 PATIENT WORKFLOW (8 tables)

### 12. **Appointment**
- Schedule patient visits
- Fields: `tenantId`, `patientId`, `departmentId`, `doctorId`, `appointmentDate`, `appointmentTime`, `tokenNumber`, `status` (BOOKED/CONFIRMED/CANCELLED/COMPLETED/NO_SHOW), `notes`, `timestamps`

### 13. **Visit**
- Patient check-in & consultation session
- Fields: `tenantId`, `patientId`, `appointmentId`, `doctorId`, `departmentId`
- Visit Details: `visitType` (OPD/IPD/EMERGENCY), `visitNumber`, `priority` (EMERGENCY/URGENT/NORMAL/LOW)
- Timing: `checkInTime`, `startTime`, `endTime`, `status` (WAITING/IN_PROGRESS/COMPLETED/CANCELLED/TRANSFERRED), `notes`
- Unique: `[tenantId, patientId, visitNumber]`
- Relations: vitals, consultations, prescriptions, labOrders, invoices

### 14. **Vital**
- Patient vital signs recording
- Fields: `tenantId`, `visitId`, `recordedAt`, `recordedBy`
- Measurements: `bloodPressureSystolic`, `bloodPressureDiastolic`, `pulseRate`, `temperature` (with unit), `spO2`, `weight` (with unit), `height` (with unit), `bmi`, `respiratoryRate`, `notes`

### 15. **Consultation**
- Doctor's clinical notes per visit
- Fields: `tenantId`, `visitId`, `doctorId`, `consultationDate`, `status` (IN_PROGRESS/COMPLETED/CANCELLED)
- Clinical Data:
  - Chief Complaint: `chiefComplaint`, `historyOfPresentIllness`
  - History: `pastMedicalHistory`, `familyHistory`, `socialHistory`, `allergies`, `medications`
  - Examination: `physicalExamination`
  - Assessment: `diagnosis`, `differentialDiagnosis`, `investigations`, `treatmentPlan`, `followUpPlan`, `notes`
- Unique: One consultation per visit

### 16. **Prescription**
- Medication orders
- Fields: `tenantId`, `visitId`, `patientId`, `doctorId`, `prescriptionDate`, `status` (ACTIVE/COMPLETED/CANCELLED), `notes`, `timestamps`
- Relations: prescriptionItems (line items for medicines)

### 17. **PrescriptionItem**
- Individual medicines in a prescription
- Fields: `tenantId`, `prescriptionId`
- Medicine: `medicineName`, `genericName`, `strength`, `dosageForm`, `route`
- Dosage: `dosage`, `frequency`, `duration`, `timing`, `instructions`, `quantity`
- Dispensing: `isDispensed`, `dispensedAt`, `dispensedBy`

### 18. **LabOrder**
- Laboratory test requests
- Fields: `tenantId`, `visitId`, `patientId`, `doctorId`, `orderNumber` (unique per tenant), `orderDate`, `priority`, `status` (ORDERED/SAMPLE_COLLECTED/IN_PROGRESS/COMPLETED/CANCELLED), `notes`
- Relations: labResults

### 19. **LabResult**
- Individual lab test results
- Fields: `tenantId`, `labOrderId`
- Test: `testName`, `testCode`, `category` (Hematology/Biochemistry/etc.)
- Result: `result`, `unit`, `referenceRange`, `isNormal`, `isCritical`
- Verification: `performedAt`, `performedBy`, `verifiedAt`, `verifiedBy`, `notes`

---

## 💰 BILLING (3 tables)

### 20. **Invoice**
- Patient billing
- Fields: `tenantId`, `visitId`, `patientId`, `invoiceNumber` (unique per tenant), `invoiceDate`, `dueDate`
- Financials: `subtotal`, `discount`, `tax`, `total`, `paidAmount`, `outstanding`
- Status: DRAFT/FINAL/PAID/PARTIAL/OVERDUE/CANCELLED
- Relations: payments, items

### 21. **InvoiceItem**
- Line items in invoices
- Fields: `tenantId`, `invoiceId`, `itemType` (CONSULTATION/PROCEDURE/LAB_TEST/MEDICINE/ROOM_CHARGE/OTHER), `itemId` (reference to actual item), `description`, `quantity`, `unitPrice`, `discount`, `total`

### 22. **Payment**
- Payment records
- Fields: `tenantId`, `invoiceId`, `patientId`, `paymentNumber` (unique per tenant), `paymentDate`, `amount`
- Method: `paymentMethod` (CASH/CARD/UPI/NET_BANKING/CHEQUE/INSURANCE/OTHER), `reference`, `receivedBy`, `notes`

---

## 🔤 ENUMERATIONS

### Gender
- MALE, FEMALE, OTHER

### BloodGroup
- A_POSITIVE, A_NEGATIVE, B_POSITIVE, B_NEGATIVE, AB_POSITIVE, AB_NEGATIVE, O_POSITIVE, O_NEGATIVE

### PatientStatus
- ACTIVE, INACTIVE, DECEASED

### AppointmentStatus
- BOOKED, CONFIRMED, CANCELLED, COMPLETED, NO_SHOW

### VisitType
- OPD (Outpatient), IPD (Inpatient), EMERGENCY

### VisitStatus
- WAITING, IN_PROGRESS, COMPLETED, CANCELLED, TRANSFERRED

### Priority
- EMERGENCY, URGENT, NORMAL, LOW

### ConsultationStatus
- IN_PROGRESS, COMPLETED, CANCELLED

### PrescriptionStatus
- ACTIVE, COMPLETED, CANCELLED

### LabOrderStatus
- ORDERED, SAMPLE_COLLECTED, IN_PROGRESS, COMPLETED, CANCELLED

### InvoiceStatus
- DRAFT, FINAL, PAID, PARTIAL, OVERDUE, CANCELLED

### InvoiceItemType
- CONSULTATION, PROCEDURE, LAB_TEST, MEDICINE, ROOM_CHARGE, OTHER

### PaymentMethod
- CASH, CARD, UPI, NET_BANKING, CHEQUE, INSURANCE, OTHER

### TenantType
- HOSPITAL, CLINIC

---

## 📈 KEY INDEXES

**Performance Optimizations**:
- Multi-column indexes on frequently queried combinations (e.g., `[tenantId, appointmentDate]`)
- Unique indexes on business identifiers (e.g., `[tenantId, uhid]` for patient UHID)
- Foreign key indexes for joins (doctorId, patientId, etc.)

---

## 🔗 TENANT ISOLATION RULES

**CRITICAL**: Every query must include `tenantId` filter:
```sql
-- CORRECT
SELECT * FROM Patient WHERE tenantId = $1 AND status = 'ACTIVE'

-- WRONG (Data leak!)
SELECT * FROM Patient WHERE status = 'ACTIVE'
```

---

## 📊 SAMPLE DATA (Dev/Seed)

**Tenant**: DEMO
- Type: HOSPITAL
- License: PRO plan, 50 users, 1 year valid

**Roles**: ADMIN, DOCTOR, RECEPTIONIST, LAB_TECH, BILLING, ACCOUNTANT

**Users**:
- Super Admin: `superadmin` / `224466` (no tenant)
- Tenant Admin: `admin` / `admin123` (DEMO tenant)

**Permissions**: 50+ codes covering patient, appointment, consultation, prescription, vitals, lab, and billing operations

---

## 🚀 Database Connection

**PostgreSQL 16+**
```
DATABASE_URL="postgresql://postgres:224466@localhost:5432/hms_db"
```

**Prisma Client Location**: `app/generated/prisma/`

**Migrations**: Run with `npm run db:migrate`

---

## 📝 Common Queries

### Get Active Patients
```
Patient.findMany({ where: { tenantId, status: "ACTIVE" } })
```

### Get Today's Appointments
```
Appointment.findMany({
  where: { 
    tenantId,
    appointmentDate: today,
    status: { not: "CANCELLED" }
  }
})
```

### Get Patient Consultation History
```
Consultation.findMany({
  where: { visit: { patientId } },
  include: { visit: true, doctor: true }
})
```

### Get Invoice Details
```
Invoice.findUnique({
  where: { tenantId_invoiceNumber: { tenantId, invoiceNumber } },
  include: { items: true, payments: true, patient: true }
})
```
