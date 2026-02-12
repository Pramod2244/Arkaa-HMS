# HMS Cloud - Complete Database Schema

## 📊 Database Overview
- **Total Tables**: 23
- **Database**: PostgreSQL 16
- **ORM**: Prisma 7
- **Multi-tenant**: Yes (all tables scoped by `tenantId`)

---

## 1️⃣ MULTI-TENANT CORE (4 Tables)

### **Tenant**
Master record for organizations (Hospital/Clinic)

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | UUID | PK, Default(uuid) |
| `name` | String | Required |
| `code` | String | UNIQUE, Required |
| `type` | TenantType Enum | HOSPITAL, CLINIC |
| `contact` | String | Optional |
| `isActive` | Boolean | Default(true), Indexed |
| `createdAt` | DateTime | Default(now()) |
| `updatedAt` | DateTime | Auto-update |
| `createdBy` | String | Optional |
| `updatedBy` | String | Optional |

**Indexes**: `code`, `isActive`

---

### **TenantLicense**
Subscription/licensing per tenant

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | UUID | PK, Default(uuid) |
| `tenantId` | UUID | FK → Tenant, UNIQUE |
| `plan` | String | BASIC, PRO, ENTERPRISE |
| `maxUsers` | Int | Default(10) |
| `startDate` | DateTime | Required |
| `endDate` | DateTime | Required, Indexed |
| `isActive` | Boolean | Default(true) |
| `createdAt` | DateTime | Default(now()) |
| `updatedAt` | DateTime | Auto-update |
| `createdBy` | String | Optional |
| `updatedBy` | String | Optional |

**Indexes**: `tenantId`, `endDate`

---

### **TenantSetting**
Key-value configuration store

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | UUID | PK, Default(uuid) |
| `tenantId` | UUID | FK → Tenant |
| `key` | String | Required |
| `value` | JSON | Required |
| `createdAt` | DateTime | Default(now()) |
| `updatedAt` | DateTime | Auto-update |
| `createdBy` | String | Optional |
| `updatedBy` | String | Optional |

**Indexes**: `tenantId`, `UNIQUE(tenantId, key)`

---

### **AuditLog**
Compliance & change tracking (all mutations logged)

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | UUID | PK, Default(uuid) |
| `tenantId` | UUID | FK → Tenant, Nullable |
| `performedBy` | String | FK → User, Nullable |
| `performedAt` | DateTime | Default(now()), Indexed |
| `entityType` | String | User, Role, Permission, Patient, etc. |
| `entityId` | String | Target record ID, Indexed |
| `action` | String | CREATE, UPDATE, DELETE |
| `oldValue` | JSON | Previous state |
| `newValue` | JSON | New state |

**Indexes**: `tenantId`, `performedBy`, `(entityType, entityId)`, `performedAt`

---

## 2️⃣ RBAC - Role-Based Access Control (5 Tables)

### **User**
Staff members/system users

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | UUID | PK, Default(uuid) |
| `tenantId` | UUID | FK → Tenant, Nullable (null = super admin) |
| `email` | String | Required, UNIQUE per tenant |
| `username` | String | Required, UNIQUE per tenant |
| `passwordHash` | String | bcrypt(12 rounds) |
| `fullName` | String | Required |
| `mobile` | String | Optional |
| `isActive` | Boolean | Default(true) |
| `isSuperAdmin` | Boolean | Default(false) |
| `createdAt` | DateTime | Default(now()) |
| `updatedAt` | DateTime | Auto-update |
| `createdBy` | String | Optional |
| `updatedBy` | String | Optional |

**Indexes**: `tenantId`, `email`, `UNIQUE(tenantId, email)`, `UNIQUE(tenantId, username)`

**Relations**: `userRoles[]`, `auditLogs[]`

---

### **Role**
Permission groups (ADMIN, DOCTOR, RECEPTIONIST, LAB_TECH, BILLING)

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | UUID | PK, Default(uuid) |
| `tenantId` | UUID | FK → Tenant |
| `code` | String | ADMIN, DOCTOR, RECEPTIONIST, etc. |
| `name` | String | Display name |
| `description` | String | Optional |
| `isSystem` | Boolean | Default(false) - built-in roles |
| `createdAt` | DateTime | Default(now()) |
| `updatedAt` | DateTime | Auto-update |
| `createdBy` | String | Optional |
| `updatedBy` | String | Optional |

**Indexes**: `tenantId`, `UNIQUE(tenantId, code)`

**Relations**: `rolePermissions[]`, `userRoles[]`

---

### **Permission**
Fine-grained access control (50+ codes)

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | UUID | PK, Default(uuid) |
| `code` | String | UNIQUE (PATIENT_VIEW, PATIENT_CREATE, etc.) |
| `name` | String | Display name |
| `module` | String | PATIENT, APPOINTMENT, VITAL, etc. |
| `description` | String | Optional |
| `createdAt` | DateTime | Default(now()) |
| `updatedAt` | DateTime | Auto-update |
| `createdBy` | String | Optional |
| `updatedBy` | String | Optional |

**Indexes**: `code`

---

### **RolePermission**
Many-to-many: Role ↔ Permission

| Column | Type | Constraints |
|--------|------|-------------|
| `roleId` | UUID | FK → Role (PK, onDelete: Cascade) |
| `permissionId` | UUID | FK → Permission (PK, onDelete: Cascade) |

**Composite Primary Key**: `(roleId, permissionId)`

**Indexes**: `roleId`, `permissionId`

---

### **UserRole**
Many-to-many: User ↔ Role

| Column | Type | Constraints |
|--------|------|-------------|
| `userId` | UUID | FK → User (PK, onDelete: Cascade) |
| `roleId` | UUID | FK → Role (PK, onDelete: Cascade) |

**Composite Primary Key**: `(userId, roleId)`

**Indexes**: `userId`, `roleId`

---

## 3️⃣ CORE ENTITIES (2 Tables)

### **Department**
Hospital departments (Cardiology, Orthopedics, etc.)

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | UUID | PK, Default(uuid) |
| `tenantId` | UUID | FK → Tenant |
| `name` | String | Required |
| `code` | String | Optional |
| `isActive` | Boolean | Default(true), Indexed |
| `createdAt` | DateTime | Default(now()) |
| `updatedAt` | DateTime | Auto-update |
| `createdBy` | String | Optional |
| `updatedBy` | String | Optional |

**Indexes**: `tenantId`, `UNIQUE(tenantId, name)`, `(tenantId, isActive)`

**Relations**: `appointments[]`, `visits[]`

---

### **Patient**
Patient master records

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | UUID | PK, Default(uuid) |
| `tenantId` | UUID | FK → Tenant |
| `uhid` | String | Unique Hospital ID (tenant-scoped), UNIQUE |
| `firstName` | String | Required |
| `lastName` | String | Optional |
| `gender` | Gender Enum | MALE, FEMALE, OTHER |
| `dateOfBirth` | DateTime | Required |
| `phoneNumber` | String | Required, Indexed |
| `email` | String | Optional |
| `address` | String | Optional |
| `emergencyContactName` | String | Optional |
| `emergencyContactPhone` | String | Optional |
| `bloodGroup` | BloodGroup Enum | A_POSITIVE, O_NEGATIVE, etc. |
| `allergies` | String | Optional |
| `medicalHistory` | String | Optional |
| `status` | PatientStatus Enum | ACTIVE, INACTIVE, DECEASED |
| `createdAt` | DateTime | Default(now()) |
| `updatedAt` | DateTime | Auto-update |
| `createdBy` | String | Optional |
| `updatedBy` | String | Optional |

**Indexes**: `tenantId`, `(tenantId, uhid)`, `(tenantId, phoneNumber)`, `(tenantId, firstName, lastName)`, `(tenantId, status)`

**Relations**: `appointments[]`, `visits[]`, `prescriptions[]`, `labOrders[]`, `invoices[]`, `payments[]`

---

## 4️⃣ PATIENT WORKFLOW (8 Tables)

### **Appointment**
Schedule patient visits

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | UUID | PK, Default(uuid) |
| `tenantId` | UUID | FK → Tenant |
| `patientId` | UUID | FK → Patient |
| `departmentId` | UUID | FK → Department, Nullable |
| `doctorId` | UUID | FK → User, Nullable |
| `appointmentDate` | DateTime | Required, Indexed |
| `appointmentTime` | String | HH:MM format, Optional |
| `tokenNumber` | Int | Optional |
| `status` | AppointmentStatus | BOOKED, CONFIRMED, CANCELLED, COMPLETED, NO_SHOW |
| `notes` | String | Optional |
| `createdAt` | DateTime | Default(now()) |
| `updatedAt` | DateTime | Auto-update |
| `createdBy` | String | Optional |
| `updatedBy` | String | Optional |

**Indexes**: `tenantId`, `patientId`, `doctorId`, `appointmentDate`, `status`, `(tenantId, appointmentDate)`

**Relations**: `visits[]`

---

### **Visit**
Patient visit/consultation session

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | UUID | PK, Default(uuid) |
| `tenantId` | UUID | FK → Tenant |
| `patientId` | UUID | FK → Patient |
| `appointmentId` | UUID | FK → Appointment, Nullable |
| `doctorId` | UUID | FK → User, Nullable |
| `departmentId` | UUID | FK → Department, Nullable |
| `visitType` | VisitType Enum | OPD, IPD, EMERGENCY |
| `visitNumber` | Int | Sequential per patient |
| `status` | VisitStatus Enum | WAITING, IN_PROGRESS, COMPLETED, CANCELLED, TRANSFERRED |
| `priority` | Priority Enum | EMERGENCY, URGENT, NORMAL, LOW |
| `checkInTime` | DateTime | Optional |
| `startTime` | DateTime | Optional |
| `endTime` | DateTime | Optional |
| `notes` | String | Optional |
| `createdAt` | DateTime | Default(now()) |
| `updatedAt` | DateTime | Auto-update |
| `createdBy` | String | Optional |
| `updatedBy` | String | Optional |

**Indexes**: `tenantId`, `patientId`, `appointmentId`, `doctorId`, `status`, `(tenantId, patientId, visitNumber)`

**Constraints**: `UNIQUE(tenantId, patientId, visitNumber)`

**Relations**: `vitals[]`, `consultations[]`, `prescriptions[]`, `labOrders[]`, `invoices[]`

---

### **Vital**
Patient vital signs recording

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | UUID | PK, Default(uuid) |
| `tenantId` | UUID | FK → Tenant |
| `visitId` | UUID | FK → Visit |
| `recordedAt` | DateTime | Default(now()), Indexed |
| `recordedBy` | String | Nurse/staff ID |
| `bloodPressureSystolic` | Int | Optional (mmHg) |
| `bloodPressureDiastolic` | Int | Optional (mmHg) |
| `pulseRate` | Int | Optional (bpm) |
| `temperature` | Float | Optional (°C or °F) |
| `temperatureUnit` | String | C or F |
| `spO2` | Int | Optional (%) |
| `weight` | Float | Optional |
| `weightUnit` | String | kg or lbs |
| `height` | Float | Optional |
| `heightUnit` | String | cm or inches |
| `bmi` | Float | Optional (auto-calculated) |
| `respiratoryRate` | Int | Optional (breaths/min) |
| `notes` | String | Optional |

**Indexes**: `tenantId`, `visitId`, `recordedAt`

---

### **Consultation**
Doctor's clinical notes

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | UUID | PK, Default(uuid) |
| `tenantId` | UUID | FK → Tenant |
| `visitId` | UUID | FK → Visit, UNIQUE (one per visit) |
| `doctorId` | UUID | FK → User |
| `consultationDate` | DateTime | Default(now()) |
| `chiefComplaint` | String | Required |
| `historyOfPresentIllness` | String | Optional |
| `pastMedicalHistory` | String | Optional |
| `familyHistory` | String | Optional |
| `socialHistory` | String | Optional |
| `allergies` | String | Optional |
| `medications` | String | Current medications |
| `physicalExamination` | String | Optional |
| `diagnosis` | String | Optional |
| `differentialDiagnosis` | String | Optional |
| `investigations` | String | Required tests |
| `treatmentPlan` | String | Optional |
| `followUpPlan` | String | Optional |
| `status` | ConsultationStatus | IN_PROGRESS, COMPLETED, CANCELLED |
| `notes` | String | Optional |
| `createdAt` | DateTime | Default(now()) |
| `updatedAt` | DateTime | Auto-update |
| `createdBy` | String | Optional |
| `updatedBy` | String | Optional |

**Indexes**: `tenantId`, `visitId`, `doctorId`

---

### **Prescription**
Medication orders

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | UUID | PK, Default(uuid) |
| `tenantId` | UUID | FK → Tenant |
| `visitId` | UUID | FK → Visit |
| `patientId` | UUID | FK → Patient |
| `doctorId` | UUID | FK → User |
| `prescriptionDate` | DateTime | Default(now()) |
| `status` | PrescriptionStatus | ACTIVE, COMPLETED, CANCELLED |
| `notes` | String | Optional |
| `createdAt` | DateTime | Default(now()) |
| `updatedAt` | DateTime | Auto-update |
| `createdBy` | String | Optional |
| `updatedBy` | String | Optional |

**Indexes**: `tenantId`, `visitId`, `patientId`, `doctorId`, `status`

**Relations**: `items[]` (PrescriptionItem)

---

### **PrescriptionItem**
Individual medicines in a prescription

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | UUID | PK, Default(uuid) |
| `tenantId` | UUID | FK → Tenant |
| `prescriptionId` | UUID | FK → Prescription |
| `medicineName` | String | Required |
| `genericName` | String | Optional |
| `strength` | String | e.g., "500mg" |
| `dosageForm` | String | tablet, capsule, syrup, injection |
| `route` | String | oral, IV, topical, IM |
| `dosage` | String | "1 tablet", "5ml" |
| `frequency` | String | "twice daily", "every 8 hours" |
| `duration` | String | "7 days", "2 weeks" |
| `timing` | String | before food, after food, with food |
| `instructions` | String | Optional |
| `quantity` | Int | Optional |
| `isDispensed` | Boolean | Default(false) |
| `dispensedAt` | DateTime | Optional |
| `dispensedBy` | String | Pharmacist ID |
| `createdAt` | DateTime | Default(now()) |
| `updatedAt` | DateTime | Auto-update |

**Indexes**: `tenantId`, `prescriptionId`, `isDispensed`

---

### **LabOrder**
Lab test orders

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | UUID | PK, Default(uuid) |
| `tenantId` | UUID | FK → Tenant |
| `visitId` | UUID | FK → Visit |
| `patientId` | UUID | FK → Patient |
| `doctorId` | UUID | FK → User |
| `orderNumber` | String | UNIQUE per tenant |
| `orderDate` | DateTime | Default(now()), Indexed |
| `status` | LabOrderStatus | ORDERED, SAMPLE_COLLECTED, IN_PROGRESS, COMPLETED, CANCELLED |
| `priority` | Priority Enum | EMERGENCY, URGENT, NORMAL, LOW |
| `notes` | String | Optional |
| `createdAt` | DateTime | Default(now()) |
| `updatedAt` | DateTime | Auto-update |
| `createdBy` | String | Optional |
| `updatedBy` | String | Optional |

**Indexes**: `tenantId`, `visitId`, `patientId`, `doctorId`, `status`, `orderDate`

**Constraints**: `UNIQUE(tenantId, orderNumber)`

**Relations**: `results[]` (LabResult)

---

### **LabResult**
Lab test results

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | UUID | PK, Default(uuid) |
| `tenantId` | UUID | FK → Tenant |
| `labOrderId` | UUID | FK → LabOrder |
| `testName` | String | Required, Indexed |
| `testCode` | String | Optional |
| `category` | String | Hematology, Biochemistry, Microbiology, etc. |
| `result` | String | Test result value |
| `unit` | String | mg/dL, mmol/L, etc. |
| `referenceRange` | String | Normal range |
| `isNormal` | Boolean | Optional |
| `isCritical` | Boolean | Default(false), Indexed |
| `performedAt` | DateTime | Optional |
| `performedBy` | String | Lab technician |
| `verifiedAt` | DateTime | Optional |
| `verifiedBy` | String | Pathologist |
| `notes` | String | Optional |
| `createdAt` | DateTime | Default(now()) |
| `updatedAt` | DateTime | Auto-update |

**Indexes**: `tenantId`, `labOrderId`, `testName`, `isCritical`

---

## 5️⃣ BILLING (3 Tables)

### **Invoice**
Patient billing records

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | UUID | PK, Default(uuid) |
| `tenantId` | UUID | FK → Tenant |
| `visitId` | UUID | FK → Visit |
| `patientId` | UUID | FK → Patient |
| `invoiceNumber` | String | UNIQUE per tenant |
| `invoiceDate` | DateTime | Default(now()), Indexed |
| `dueDate` | DateTime | Optional, Indexed |
| `status` | InvoiceStatus | DRAFT, FINAL, PAID, PARTIAL, OVERDUE, CANCELLED |
| `subtotal` | Float | Default(0) |
| `discount` | Float | Default(0) |
| `tax` | Float | Default(0) |
| `total` | Float | Default(0) |
| `paidAmount` | Float | Default(0) |
| `outstanding` | Float | Default(0) |
| `notes` | String | Optional |
| `createdAt` | DateTime | Default(now()) |
| `updatedAt` | DateTime | Auto-update |
| `createdBy` | String | Optional |
| `updatedBy` | String | Optional |

**Indexes**: `tenantId`, `visitId`, `patientId`, `status`, `invoiceDate`, `dueDate`

**Constraints**: `UNIQUE(tenantId, invoiceNumber)`

**Relations**: `payments[]`, `items[]`

---

### **InvoiceItem**
Individual line items in invoice

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | UUID | PK, Default(uuid) |
| `tenantId` | UUID | FK → Tenant |
| `invoiceId` | UUID | FK → Invoice |
| `itemType` | InvoiceItemType | CONSULTATION, PROCEDURE, LAB_TEST, MEDICINE, ROOM_CHARGE, OTHER |
| `itemId` | String | Reference to source (prescription, lab order, etc.) |
| `description` | String | Required |
| `quantity` | Int | Default(1) |
| `unitPrice` | Float | Required |
| `discount` | Float | Default(0) |
| `total` | Float | Quantity × (unitPrice - discount) |
| `createdAt` | DateTime | Default(now()) |
| `updatedAt` | DateTime | Auto-update |

**Indexes**: `tenantId`, `invoiceId`, `itemType`

---

### **Payment**
Payment transactions

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | UUID | PK, Default(uuid) |
| `tenantId` | UUID | FK → Tenant |
| `invoiceId` | UUID | FK → Invoice |
| `patientId` | UUID | FK → Patient |
| `paymentNumber` | String | UNIQUE per tenant |
| `paymentDate` | DateTime | Default(now()), Indexed |
| `amount` | Float | Required |
| `paymentMethod` | PaymentMethod | CASH, CARD, UPI, NET_BANKING, CHEQUE, INSURANCE, OTHER |
| `reference` | String | Check number, transaction ID, etc. |
| `notes` | String | Optional |
| `receivedBy` | String | Cashier/staff ID |
| `createdAt` | DateTime | Default(now()) |
| `updatedAt` | DateTime | Auto-update |

**Indexes**: `tenantId`, `invoiceId`, `patientId`, `paymentDate`

**Constraints**: `UNIQUE(tenantId, paymentNumber)`

---

## 📋 ENUMS

### AppointmentStatus
- BOOKED
- CONFIRMED
- CANCELLED
- COMPLETED
- NO_SHOW

### VisitType
- OPD (Outpatient)
- IPD (Inpatient)
- EMERGENCY

### VisitStatus
- WAITING
- IN_PROGRESS
- COMPLETED
- CANCELLED
- TRANSFERRED

### PatientStatus
- ACTIVE
- INACTIVE
- DECEASED

### Gender
- MALE
- FEMALE
- OTHER

### BloodGroup
- A_POSITIVE, A_NEGATIVE
- B_POSITIVE, B_NEGATIVE
- AB_POSITIVE, AB_NEGATIVE
- O_POSITIVE, O_NEGATIVE

### Priority
- EMERGENCY
- URGENT
- NORMAL
- LOW

### ConsultationStatus
- IN_PROGRESS
- COMPLETED
- CANCELLED

### PrescriptionStatus
- ACTIVE
- COMPLETED
- CANCELLED

### LabOrderStatus
- ORDERED
- SAMPLE_COLLECTED
- IN_PROGRESS
- COMPLETED
- CANCELLED

### InvoiceStatus
- DRAFT
- FINAL
- PAID
- PARTIAL
- OVERDUE
- CANCELLED

### PaymentMethod
- CASH
- CARD
- UPI
- NET_BANKING
- CHEQUE
- INSURANCE
- OTHER

### InvoiceItemType
- CONSULTATION
- PROCEDURE
- LAB_TEST
- MEDICINE
- ROOM_CHARGE
- OTHER

### TenantType
- HOSPITAL
- CLINIC

---

## 🔗 Key Relationships

### Patient Workflow Flow
```
Patient → Appointment → Visit → {Vitals + Consultation + Prescription + LabOrder}
              ↓            ↓
              └────────────→ Invoice → Payment
```

### Access Control Flow
```
User → UserRole → Role → RolePermission → Permission
```

### Audit Trail
```
All mutations → AuditLog (entityType, entityId, action, oldValue, newValue)
```

---

## 🔒 Multi-Tenant Security

All tables include `tenantId` column ensuring:
- **Data Isolation**: Queries must filter by `tenantId`
- **Cascade Delete**: Tenant deletion cascades to all data
- **Indexed Access**: All `tenantId` fields indexed for performance

Example tenant-scoped query:
```sql
SELECT * FROM "Patient" WHERE "tenantId" = 'abc-123' AND "status" = 'ACTIVE'
```

---

## 📊 Database Statistics

| Metric | Value |
|--------|-------|
| Total Tables | 23 |
| Total Columns | ~250+ |
| Primary Keys | 23 (all UUID) |
| Foreign Keys | ~40+ |
| Indexes | 80+ |
| Enums | 14 |
| Relationships | 100+ |

---

**Last Updated**: February 4, 2026
**Prisma Version**: 7.3.0
**PostgreSQL Version**: 16+
