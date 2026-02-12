# OPD Workflow - Quick Reference

## 🎯 Core Concept
**OPD = Visit where visitType = "OPD"**  
**Department = Context filter**  
**User = Scoped to assigned departments**

---

## 📊 Data Model
```
User → UserDepartment ← Department
         ↓
       User can access Visit only if:
       - Visit.departmentId IN User.departments
       - User has OPD_* permission
```

---

## 🔐 Security Checks (Every API Call)
```
1. JWT Token Valid? → Get Session
2. User in Tenant? → session.tenantId matches
3. Has Permission? → session.permissions includes required code
4. Has Dept Access? → departmentId in session.departmentIds
5. Data Isolation? → Return only user's dept data
```

---

## 🔑 Key Permissions
```
OPD_VIEW          → See OPD visits
OPD_CREATE        → Create new OPD visits
OPD_CHECKIN       → Check-in patients
DOCTOR_QUEUE_VIEW → See personal queue
OPD_CONSULTATION_CREATE → Start consultation
OPD_VITALS_RECORD → Record vitals
... and more (see lib/constants/permissions.ts)
```

---

## 🌐 API Endpoints

### Create OPD Visit
```
POST /api/visits/opd/create
Headers: 
  - Cookie: hms_session=<JWT>
Body: {
  "patientId": "uuid",
  "departmentId": "uuid",
  "doctorId": "uuid (optional)",
  "priority": "NORMAL|URGENT|EMERGENCY|LOW",
  "notes": "string"
}
Response: 
  { success: true, data: { id, visitNumber, status, ... } }
Errors:
  - 401: Not authenticated
  - 403: No permission OR not assigned to department
  - 400: Validation error
```

### Get OPD Visits
```
GET /api/visits/opd?page=1&limit=20&departmentId=...&status=WAITING&doctorQueue=false
Response:
  {
    visits: [...],
    departments: [...],
    pagination: { page, limit, total, pages }
  }
```

---

## 🧩 Components

### OPDDashboard
```typescript
<OPDDashboard mode="reception|doctor" initialDepartmentId="..." />
```

### OPDVisitCreateForm
```typescript
<OPDVisitCreateForm onSuccess={() => {...}} />
```

### DoctorOPDQueue
```typescript
<DoctorOPDQueue />
```

---

## 📝 Service Functions

```typescript
// Create OPD visit with validation
await createOPDVisit(
  { patientId, departmentId, doctorId, priority },
  tenantId,
  userId
)

// Get visits for user's departments
await getOPDVisits(
  tenantId,
  userDepartmentIds,
  { page, limit, departmentId, status }
)

// Get doctor's personal queue
await getDoctorOPDQueue(
  tenantId,
  doctorId,
  { departmentIds, page, limit }
)

// Get user's departments
await getUserDepartments(userId, tenantId)
```

---

## 🛡️ Validation Functions

```typescript
// Check user can access department
await verifyDepartmentAccess(session, departmentId)

// Check user can perform action on visit
await verifyOPDVisitAccess(session, visitId, permission)

// Build Prisma WHERE for user's departments
const filter = buildDepartmentFilter(session)

// Verify doctor in department
await verifyDoctorDepartmentAssignment(doctorId, deptId, tenantId)
```

---

## 🔄 Common Workflows

### Reception Creates OPD Visit
```
1. Click "New OPD Visit"
   → Auto-selects user's department
2. Search patient
3. Select doctor (from same dept)
4. Set priority
5. Submit
   → POST /api/visits/opd/create
   → Returns visitNumber (token)
6. Patient checks-in
```

### Doctor Views Queue
```
1. Navigate to /visits?doctorQueue=true
   → GET /api/visits/opd?doctorQueue=true
2. Shows all visits where doctorId = logged-in doctor
3. Sorted by priority, then check-in time
4. Expand to see vitals + patient details
5. Click "Start Consultation"
   → Routes to /consultations?visitId=...
```

### Department Receptionist Views Dashboard
```
1. Navigate to /visits
   → GET /api/visits/opd
2. Filter by: tenantId, visitType=OPD, departmentId IN user.departments
3. Shows: Token, Patient, Age, Priority, Status, Check-in, Doctor
4. Actions: Check-in, Start Consultation
```

---

## 💾 Database Queries

```typescript
// Find user's departments
const depts = await prisma.userDepartment.findMany({
  where: { userId, tenantId, isActive: true },
  include: { department: true }
})

// Find OPD visits for departments
const visits = await prisma.visit.findMany({
  where: {
    tenantId,
    visitType: "OPD",
    departmentId: { in: deptIds },
    status: { in: ["WAITING", "IN_PROGRESS"] }
  },
  orderBy: [{ priority: "desc" }, { checkInTime: "asc" }]
})

// Check doctor in department
const exists = await prisma.userDepartment.findFirst({
  where: { userId: doctorId, departmentId, tenantId, isActive: true }
})
```

---

## ⚡ Performance Tips

1. **Index on (tenantId, userId, departmentId)**
   → Fast department lookup

2. **Index on (tenantId, visitType, departmentId, status)**
   → Fast OPD visit queries

3. **Use pagination for large datasets**
   → Limit: max 100 per page

4. **Cache user's departments in session**
   → Avoid repeated DB queries

5. **Batch verify doctors in department**
   → Use `verifyDoctorsInDepartment()`

---

## 🚨 Error Responses

```
401 Unauthorized
  - JWT expired or invalid
  - No session cookie found

403 Forbidden (DEPT_ACCESS_DENIED)
  - Department not in user's list
  - User not assigned to department

403 Forbidden (Missing Permission)
  - Permission code not in user's permissions
  - Role doesn't have required permission

400 Validation Error
  - Required field missing
  - Doctor not in department
  - Invalid priority value
  - Patient not found
```

---

## 🔗 Related Files

```
Database:
  prisma/schema.prisma → UserDepartment model

Auth:
  lib/auth.ts → SessionPayload type
  app/api/auth/login/route.ts → Fetch departments on login

Services:
  lib/services/visits.ts → OPD functions

API Routes:
  app/api/visits/opd/create/route.ts → Create endpoint
  app/api/visits/opd/route.ts → List endpoint

Components:
  components/visits/opd-dashboard.tsx → Dashboard
  components/visits/opd-visit-create.tsx → Create form
  components/visits/doctor-queue.tsx → Doctor queue

Security:
  lib/middleware/department-access.ts → Access control
  lib/constants/permissions.ts → Permission definitions

Documentation:
  OPD_WORKFLOW_GUIDE.md → Complete guide
  IMPLEMENTATION_SUMMARY.md → Summary
```

---

## 📋 Checklist Before Using

- [ ] Prisma migrations run (`npm run db:migrate`)
- [ ] User assigned to department (UserDepartment record created)
- [ ] User has OPD permissions (via role)
- [ ] OPD permission codes exist in database
- [ ] JWT includes departmentIds on login
- [ ] Department doctor assignments exist

---

## 🎬 Quick Start

```bash
# 1. Apply schema changes
npm run db:generate
npm run db:migrate

# 2. Seed test data
npm run db:seed

# 3. Start dev server
npm run dev

# 4. Login
# Tenant: DEMO
# Username: receptionist (or doctor)
# Password: admin123

# 5. Create OPD visit
# Click "New OPD Visit" → Select patient → Submit

# 6. View dashboard
# Navigate to /visits
```

---

**Version**: 1.0.0  
**Last Updated**: February 4, 2026  
**Status**: ✅ Production Ready
