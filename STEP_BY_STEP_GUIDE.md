# Step-by-Step Guide to OPD Workflow Implementation

**Goal**: Understand and follow what was built  
**Time**: ~30 minutes  
**Difficulty**: Beginner-friendly

---

## 📍 STEP 1: Understand the Data Model

### What was added to the database?

**New Table**: `UserDepartment`

```
User (staff members)
  ↓ (many-to-many mapping)
UserDepartment
  ↓ (many-to-many mapping)
Department (Cardiology, Anatomy, etc.)
```

### Files to check:

**File**: [prisma/schema.prisma](prisma/schema.prisma)

```
Lines 1-50: Look for "model UserDepartment"
```

**What you'll see**:
```typescript
model UserDepartment {
  id           String   @id @default(uuid())
  tenantId     String
  userId       String
  departmentId String
  isActive     Boolean  @default(true)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
}
```

**Key concept**: A user can belong to **multiple departments**
- Example: Dr. Smith can work in Cardiology AND Anatomy
- Receptionist assigned to only Cardiology

### ✅ Check this by running:
```bash
# Look at the schema file
cat prisma/schema.prisma | grep -A 20 "model UserDepartment"
```

---

## 📍 STEP 2: Understand Authentication Session

### What changed in login?

When a user logs in, their departments are now fetched and included in the JWT token.

### Files to check:

**File 1**: [lib/auth.ts](lib/auth.ts)  
Lines 1-20: Look for `SessionPayload` type

**Before (old)**:
```typescript
type SessionPayload = {
  userId: string;
  permissions: string[];
  tenantId: string;
  // ... NO departments
}
```

**After (new)**:
```typescript
type SessionPayload = {
  userId: string;
  permissions: string[];
  tenantId: string;
  departmentIds: string[];  // ← NEW: User's departments
}
```

**File 2**: [app/api/auth/login/route.ts](app/api/auth/login/route.ts)  
Lines 40-55: Look for `userDepartments` query

**What happens during login**:
```typescript
// 1. Query user with their departments
const user = await prisma.user.findFirst({
  include: {
    userDepartments: {              // ← Fetch departments
      where: { isActive: true },
      select: { departmentId: true },
    },
  },
});

// 2. Extract department IDs
const departmentIds = user.userDepartments.map(ud => ud.departmentId);
// Result: ["dept-cardio-123", "dept-anatomy-456"]

// 3. Include in JWT token
const token = await createTenantToken({
  userId,
  permissions,
  departmentIds,  // ← Include in token
});
```

### ✅ Test this:
```bash
# 1. Login to http://localhost:3000/login
# Tenant: DEMO
# Username: admin
# Password: admin123

# 2. After login, check browser DevTools → Application → Cookies
# Look for: hms_session cookie (JWT token)

# 3. Decode the JWT at jwt.io to see departmentIds inside
```

---

## 📍 STEP 3: Understand Service Functions

### Where is the business logic?

**File**: [lib/services/visits.ts](lib/services/visits.ts)

This file has **4 new OPD functions**:

### Function 1: `createOPDVisit()`

**Purpose**: Create an OPD visit with department validation

**Location**: Lines 280-350

**What it does**:
```typescript
async function createOPDVisit(
  data: {
    patientId: string;
    departmentId: string;      // Must be user's department
    doctorId?: string;         // Must belong to same department
    priority?: string;
  },
  tenantId: string,
  userId: string
)
```

**Flow**:
1. ✅ Verify doctor belongs to department
2. ✅ Generate visit number (1, 2, 3...)
3. ✅ Create Visit with visitType="OPD"
4. ✅ Create audit log entry

**Example**:
```typescript
// Receptionist creates OPD visit
const visit = await createOPDVisit(
  {
    patientId: "patient-123",
    departmentId: "cardio-456",     // User's department
    doctorId: "doc-789",             // Must be from Cardiology
    priority: "URGENT",
  },
  "tenant-001",
  "receptionist-user-id"
);
// Returns: { id, visitNumber: 42, status: "WAITING", ... }
```

### Function 2: `getOPDVisits()`

**Purpose**: Fetch OPD visits for user's departments

**Location**: Lines 355-420

**What it does**:
```typescript
async function getOPDVisits(
  tenantId: string,
  userDepartmentIds: string[],  // User's assigned departments
  options: { page, limit, departmentId, status }
)
```

**Key feature**: Returns ONLY visits from user's departments
```typescript
// Cardiology receptionist
const result = await getOPDVisits(
  "tenant-001",
  ["cardio-dept-123"],  // Only Cardiology
  { page: 1, limit: 20 }
);
// Returns only Cardiology OPD visits
```

### Function 3: `getDoctorOPDQueue()`

**Purpose**: Get doctor's personal queue

**Location**: Lines 425-490

**What it does**:
```typescript
// Doctor sees only their pending visits
const queue = await getDoctorOPDQueue(
  "tenant-001",
  "doctor-123",
  { departmentIds: ["cardio", "anatomy"] }
);
// Returns visits where doctorId=doctor-123
// Sorted by priority, then check-in time
```

### Function 4: `getUserDepartments()`

**Purpose**: Get user's accessible departments

**Location**: Lines 495-515

**What it does**:
```typescript
// Get departments user is assigned to
const departments = await getUserDepartments(
  "user-123",
  "tenant-001"
);
// Returns: [
//   { id: "cardio-123", name: "Cardiology", code: "CARDIO" },
//   { id: "anatomy-456", name: "Anatomy", code: "ANATOMY" }
// ]
```

### ✅ Read through these functions:
```bash
# Open and read the entire file
code lib/services/visits.ts

# Or view specific lines
sed -n '280,350p' lib/services/visits.ts  # createOPDVisit
sed -n '355,420p' lib/services/visits.ts  # getOPDVisits
sed -n '425,490p' lib/services/visits.ts  # getDoctorOPDQueue
```

---

## 📍 STEP 4: Understand API Routes

### How does the frontend communicate?

**API Endpoint 1**: Create OPD Visit

**File**: [app/api/visits/opd/create/route.ts](app/api/visits/opd/create/route.ts)

**HTTP Method**: POST  
**Endpoint**: `/api/visits/opd/create`

**What it validates**:
```typescript
1. JWT token is valid?
   → throw 401 Unauthorized
   
2. User has OPD_CREATE permission?
   → throw 403 Forbidden (missing permission)
   
3. Department in user's departments?
   → throw 403 Forbidden (dept access denied)
   
4. Doctor belongs to same department?
   → throw 400 Validation error
   
5. All valid?
   → Call createOPDVisit()
   → Return success response
```

**Example request/response**:

```typescript
// Request
POST /api/visits/opd/create
Headers: { Cookie: "hms_session=<JWT>" }
Body: {
  "patientId": "pat-123",
  "departmentId": "cardio-456",
  "doctorId": "doc-789",
  "priority": "URGENT"
}

// Response (200 OK)
{
  "success": true,
  "data": {
    "id": "visit-999",
    "visitNumber": 42,
    "status": "WAITING",
    "patient": { "firstName": "John", "lastName": "Doe", ... },
    "department": { "name": "Cardiology" },
    "doctor": { "fullName": "Dr. Smith" }
  }
}

// Error response (403)
{
  "error": "Access denied. You are not assigned to this department",
  "code": "DEPT_ACCESS_DENIED"
}
```

### ✅ Find the validation logic:
```bash
code app/api/visits/opd/create/route.ts
```

Look for:
- Line 20-30: Permission check
- Line 30-40: Department access check
- Line 40-50: Call to createOPDVisit()

---

**API Endpoint 2**: Get OPD Visits

**File**: [app/api/visits/opd/route.ts](app/api/visits/opd/route.ts)

**HTTP Method**: GET  
**Endpoint**: `/api/visits/opd?page=1&limit=20&departmentId=...&doctorQueue=false`

**Query Parameters**:
- `page`: Page number (default 1)
- `limit`: Items per page (default 20, max 100)
- `departmentId`: Filter by dept (optional)
- `doctorQueue`: true for doctor's queue, false for dashboard
- `status`: WAITING, IN_PROGRESS (optional)

**Example requests**:

```typescript
// Reception: View OPD dashboard
GET /api/visits/opd?page=1&limit=20&doctorQueue=false

// Doctor: View personal queue
GET /api/visits/opd?page=1&limit=20&doctorQueue=true

// Filter by department
GET /api/visits/opd?page=1&departmentId=cardio-123&status=WAITING
```

**Response structure**:
```typescript
{
  "success": true,
  "data": {
    "visits": [
      {
        "id": "visit-123",
        "visitNumber": 42,
        "status": "WAITING",
        "priority": "URGENT",
        "patient": { "firstName": "John", ... },
        "department": { "name": "Cardiology" },
        "doctor": { "fullName": "Dr. Smith" }
      }
    ],
    "departments": [
      { "id": "cardio-123", "name": "Cardiology", "code": "CARDIO" }
    ],
    "pagination": { "page": 1, "limit": 20, "total": 45, "pages": 3 }
  }
}
```

### ✅ Test the API endpoint:
```bash
# 1. Get OPD dashboard
curl -X GET "http://localhost:3000/api/visits/opd?page=1&limit=20" \
  -H "Cookie: hms_session=<YOUR_JWT_TOKEN>"

# 2. Get doctor queue
curl -X GET "http://localhost:3000/api/visits/opd?doctorQueue=true" \
  -H "Cookie: hms_session=<YOUR_JWT_TOKEN>"
```

---

## 📍 STEP 5: Understand UI Components

### How does the frontend work?

**Component 1**: OPD Dashboard

**File**: [components/visits/opd-dashboard.tsx](components/visits/opd-dashboard.tsx)

**What it displays**:
- 📊 Stats: Waiting count, Consulting count, Total count
- 🏥 Department tabs to filter
- 📋 Table with: Token #, Patient Name, Age, Priority, Status, Check-in time, Doctor
- 🎯 Action buttons: Check-in, Start Consultation
- 📄 Pagination

**Props**:
```typescript
<OPDDashboard 
  mode="reception"  // or "doctor"
  initialDepartmentId="cardio-123"
/>
```

**Data flow**:
```
Component mounts
  ↓
GET /api/visits/opd
  ↓
Service returns visits + departments
  ↓
Render table with visits
  ↓
User clicks "Check-in" or "Consult"
  ↓
POST /api/visits/{id}/checkin or navigate to consultation
```

### Component 2: OPD Visit Creation Form

**File**: [components/visits/opd-visit-create.tsx](components/visits/opd-visit-create.tsx)

**What it displays**:
- 🏥 Department selector (auto-selects first)
- 🔍 Patient search box
- 👨‍⚕️ Doctor dropdown (filtered by department)
- ⚠️ Priority selector
- 📝 Notes field
- ✅ Submit button

**Props**:
```typescript
<OPDVisitCreateForm 
  onSuccess={() => {
    toast({ title: "Success" });
    refreshDashboard();
  }}
/>
```

**Data flow**:
```
Component mounts
  ↓
GET /api/visits/opd (to get user's departments)
  ↓
Render form with auto-selected department
  ↓
User selects patient
  ↓
GET /api/departments/{id}/doctors (fetch doctors for that dept)
  ↓
User fills form and clicks submit
  ↓
POST /api/visits/opd/create
  ↓
Validation happens on API
  ↓
Success response → Toast → Close form → Refresh dashboard
```

### Component 3: Doctor Queue

**File**: [components/visits/doctor-queue.tsx](components/visits/doctor-queue.tsx)

**What it displays**:
- 👥 Doctor's personal queue
- 🔢 Token numbers
- ❤️ Vital signs (latest)
- 🩺 Patient details (age, gender, allergies, blood group)
- 📊 Priority badges
- ▶️ "Start Consultation" button
- 🩹 "Record Vitals" button

**Data flow**:
```
Doctor logs in
  ↓
Navigate to /visits?doctorQueue=true
  ↓
GET /api/visits/opd?doctorQueue=true
  ↓
Service filters: visitType="OPD", doctorId=logged-in-doctor, 
                 status IN (WAITING, IN_PROGRESS)
  ↓
Returns queue sorted by priority then check-in time
  ↓
Render expandable list with patient details
```

### ✅ View these components:
```bash
# Open each file to understand structure
code components/visits/opd-dashboard.tsx
code components/visits/opd-visit-create.tsx
code components/visits/doctor-queue.tsx

# Look for:
# - useEffect() hooks for data fetching
# - State management with useState()
# - API calls with fetchApi()
# - UI rendering with Tailwind classes
```

---

## 📍 STEP 6: Understand Permission & Security

### How are permissions enforced?

**File**: [lib/constants/permissions.ts](lib/constants/permissions.ts)

**Permission codes defined**:
```typescript
OPD_VIEW              // View OPD visits
OPD_CREATE            // Create OPD visits
OPD_CHECKIN           // Check-in patients
DOCTOR_QUEUE_VIEW     // View doctor's queue
OPD_CONSULTATION_CREATE // Start consultation
OPD_VITALS_RECORD     // Record vitals
OPD_PRESCRIPTION_CREATE // Create prescriptions
// ... and more
```

**Role → Permissions mapping**:
```typescript
RECEPTIONIST: [
  OPD_VIEW,
  OPD_CREATE,
  OPD_CHECKIN,
  // Can see and create visits, but NOT consult or prescribe
]

DOCTOR: [
  OPD_VIEW,
  DOCTOR_QUEUE_VIEW,
  OPD_CONSULTATION_CREATE,
  OPD_VITALS_RECORD,
  OPD_PRESCRIPTION_CREATE,
  // Can view queue, consult, record vitals, prescribe
]

ADMIN: [
  // ALL permissions
]
```

### Security enforcement

**File**: [lib/middleware/department-access.ts](lib/middleware/department-access.ts)

**Key functions**:

```typescript
// Check if user can access a department
async function verifyDepartmentAccess(
  session: SessionPayload,
  departmentId: string
): Promise<boolean>
// Returns true if: departmentId in session.departmentIds

// Verify user can perform action on visit
async function verifyOPDVisitAccess(
  session: SessionPayload,
  visitId: string,
  requiredPermission: string
): Promise<boolean>
// Checks:
// 1. Permission exists
// 2. Visit exists
// 3. Visit's department in user's departments
// 4. Tenant matches

// Build WHERE clause for department filtering
function buildDepartmentFilter(
  session: SessionPayload
): Record<string, any>
// Returns: { departmentId: { in: ["dept-1", "dept-2"] } }
// Prevents SQL injection and cross-department access
```

### ✅ Check the security logic:
```bash
code lib/middleware/department-access.ts

# Look for these functions:
# - verifyDepartmentAccess() - Line ~20
# - verifyOPDVisitAccess() - Line ~35
# - buildDepartmentFilter() - Line ~60
```

---

## 📍 STEP 7: End-to-End Workflow

### Let's trace a complete OPD visit creation

```
1️⃣ RECEPTION STAFF LOGS IN
   Location: /login
   ↓
   POST /api/auth/login
   ├─ Query: User + userDepartments
   ├─ Extract: departmentIds = ["cardio-123", "anatomy-456"]
   └─ Create: JWT token with departmentIds inside

2️⃣ RECEPTION STAFF NAVIGATES TO OPD CREATION
   Location: /visits
   ↓
   Component: OPDDashboard or OPDVisitCreateForm mounts
   ├─ GET /api/visits/opd
   ├─ API checks: Permission OPD_VIEW ✅
   ├─ API returns: { visits, departments }
   └─ Form auto-selects first department (Cardiology)

3️⃣ RECEPTION STAFF SEARCHES FOR PATIENT
   Component: Patient search box
   ├─ User types: "John Doe"
   ├─ Component filters patients in memory
   ├─ User clicks: Patient "John Doe" (UHID: H123)
   └─ State updates: selectedPatient = { id, firstName, lastName, ... }

4️⃣ RECEPTION STAFF ASSIGNS DOCTOR (OPTIONAL)
   Component: Doctor dropdown
   ├─ GET /api/departments/cardio-123/doctors
   ├─ Shows: Dr. Smith, Dr. Johnson (only Cardiology doctors)
   ├─ User selects: Dr. Smith
   └─ State updates: selectedDoctor = "doc-789"

5️⃣ RECEPTION STAFF SETS PRIORITY & NOTES
   Component: Form fields
   ├─ Priority: "URGENT"
   ├─ Notes: "Chest pain, admitted from ER"
   └─ State updates with values

6️⃣ RECEPTION STAFF CLICKS SUBMIT
   Component: Form submission
   ├─ Validate: patientId ✅, departmentId ✅
   ├─ POST /api/visits/opd/create
   └─ Body: {
        patientId: "pat-123",
        departmentId: "cardio-123",
        doctorId: "doc-789",
        priority: "URGENT",
        notes: "Chest pain..."
      }

7️⃣ API ROUTE VALIDATES REQUEST
   File: app/api/visits/opd/create/route.ts
   ├─ Verify JWT valid ✅
   ├─ Check permission: OPD_CREATE in session.permissions ✅
   ├─ Check dept access: "cardio-123" in session.departmentIds ✅
   ├─ Verify doctor: belongs to Cardiology ✅
   └─ All checks pass!

8️⃣ SERVICE CREATES OPD VISIT
   File: lib/services/visits.ts
   ├─ Function: createOPDVisit()
   ├─ Get next visitNumber: 42
   ├─ Create Visit record:
   │  {
   │    id: "visit-999",
   │    visitNumber: 42,
   │    visitType: "OPD",  ← This is the key!
   │    status: "WAITING",
   │    patientId: "pat-123",
   │    departmentId: "cardio-123",
   │    doctorId: "doc-789",
   │    priority: "URGENT",
   │    checkInTime: now()
   │  }
   ├─ Create audit log:
   │  {
   │    entityType: "Visit",
   │    entityId: "visit-999",
   │    action: "CREATE",
   │    newValue: { ... },
   │    performedBy: "receptionist-user-id"
   │  }
   └─ Return created visit

9️⃣ RESPONSE SENT TO COMPONENT
   Response: {
     success: true,
     data: { id, visitNumber, status, patient, department, doctor }
   }

🔟 COMPONENT SHOWS SUCCESS
   ├─ Toast: "OPD visit created for John Doe"
   ├─ Close form
   ├─ Refresh OPD dashboard
   └─ New visit appears in list with token #42

1️⃣1️⃣ DOCTOR LOGS IN & VIEWS QUEUE
   Location: /visits?doctorQueue=true
   ├─ Session includes: departmentIds = ["cardio-123", "anatomy-456"]
   ├─ GET /api/visits/opd?doctorQueue=true
   ├─ API filters:
   │  WHERE tenantId = session.tenantId
   │  AND visitType = "OPD"
   │  AND doctorId = session.userId
   │  AND departmentId IN ["cardio-123", "anatomy-456"]
   │  AND status IN ["WAITING", "IN_PROGRESS"]
   │  ORDER BY priority DESC, checkInTime ASC
   ├─ Returns: Doctor's queue sorted by priority
   └─ Component shows: Patient with token #42

1️⃣2️⃣ DOCTOR STARTS CONSULTATION
   Doctor clicks: "Start Consultation"
   ├─ Navigate to: /consultations?visitId=visit-999
   ├─ Consultation page loads
   ├─ Can record vitals, add notes, prescribe, etc.
   └─ Everything scoped to this OPD visit
```

### ✅ Follow this workflow step-by-step:

```bash
# 1. Start dev server
npm run dev

# 2. Open http://localhost:3000/login
# Login as receptionist
# Tenant: DEMO
# Username: receptionist
# Password: admin123

# 3. Navigate to /visits
# Click "New OPD Visit" button

# 4. Search for patient "John Doe"

# 5. Select doctor

# 6. Click Submit

# 7. Check browser console (DevTools) for API calls
# DevTools → Network tab → See POST /api/visits/opd/create request

# 8. Logout and login as doctor

# 9. Navigate to /visits?doctorQueue=true
# You should see the OPD visit you just created!
```

---

## 📍 STEP 8: Database Records

### What gets created in the database?

When you create an OPD visit, here's what's written:

### UserDepartment table
```sql
INSERT INTO "UserDepartment" (
  id, tenantId, userId, departmentId, isActive, createdAt, updatedAt
) VALUES (
  'user-dept-123',
  'tenant-001',
  'receptionist-user-id',
  'cardio-dept-id',
  true,
  now(),
  now()
);

-- This means: Receptionist is assigned to Cardiology
-- When they login, their JWT will include: departmentIds = ["cardio-dept-id"]
```

### Visit table
```sql
INSERT INTO "Visit" (
  id, tenantId, visitNumber, visitType, status, patientId,
  departmentId, doctorId, priority, checkInTime, createdAt, updatedAt, createdBy
) VALUES (
  'visit-999',
  'tenant-001',
  42,
  'OPD',              -- KEY: This marks it as OPD, not IPD/EMERGENCY
  'WAITING',
  'patient-123',
  'cardio-dept-123',  -- Must match user's assigned department
  'doctor-789',
  'URGENT',
  now(),
  now(),
  now(),
  'receptionist-user-id'
);

-- This is the OPD visit
-- Doctor can see it in their queue
```

### AuditLog table
```sql
INSERT INTO "AuditLog" (
  id, tenantId, performedBy, performedAt, entityType, entityId,
  action, newValue, createdAt
) VALUES (
  'audit-456',
  'tenant-001',
  'receptionist-user-id',
  now(),
  'Visit',
  'visit-999',
  'CREATE',
  '{"id": "visit-999", "visitNumber": 42, ...}',
  now()
);

-- Audit trail for compliance
-- Shows who created the visit and when
```

### ✅ View database records:
```bash
# Connect to database
psql -U postgres -d hms_db

# Check UserDepartment mappings
SELECT u.username, d.name 
FROM "UserDepartment" ud
JOIN "User" u ON ud."userId" = u.id
JOIN "Department" d ON ud."departmentId" = d.id;

# Check OPD visits
SELECT v."visitNumber", p."firstName", d.name, v.status
FROM "Visit" v
JOIN "Patient" p ON v."patientId" = p.id
JOIN "Department" d ON v."departmentId" = d.id
WHERE v."visitType" = 'OPD'
ORDER BY v."createdAt" DESC;

# Check audit log
SELECT * FROM "AuditLog" WHERE "entityType" = 'Visit' LIMIT 5;

# Check session tokens (in memory, not in DB)
# JWT tokens stored only in browser cookies
```

---

## 📍 STEP 9: Trace a Specific File

### Let's trace what happens in OPDDashboard component

**File**: [components/visits/opd-dashboard.tsx](components/visits/opd-dashboard.tsx)

**Lines 1-30**: Imports and types
```typescript
// What data structure does the component expect?
interface OPDVisit {
  id: string;
  visitNumber: number;
  status: string;
  priority: string;
  checkInTime: string;
  patient: {
    uhid: string;
    firstName: string;
    lastName: string;
    dateOfBirth: string;
    gender: string;
  };
  doctor?: { fullName: string };
  department: { id: string; name: string };
}
```

**Lines 60-80**: Component initialization
```typescript
const [visits, setVisits] = useState<OPDVisit[]>([]);
const [departments, setDepartments] = useState<Department[]>([]);
const [selectedDept, setSelectedDept] = useState<string>("");
const [page, setPage] = useState(1);

// State for filtering and pagination
```

**Lines 85-110**: Fetch data on mount
```typescript
const fetchOPDVisits = async () => {
  // Build query string
  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
    doctorQueue: mode === "doctor" ? "true" : "false",
  });

  if (selectedDept) {
    params.append("departmentId", selectedDept);
  }

  // Make API call
  const response = await fetchApi(
    `/api/visits/opd?${params.toString()}`,
    { method: "GET" }
  );

  // Update state with response
  setVisits(response.data.visits || []);
  setDepartments(response.data.departments || []);
  setTotal(response.data.pagination?.total || 0);

  // Auto-select first department
  if (!selectedDept && response.data.departments?.length > 0) {
    setSelectedDept(response.data.departments[0].id);
  }
};

// Call on component mount and when filters change
useEffect(() => {
  fetchOPDVisits();
}, [page, limit, selectedDept, mode]);
```

**Lines 150-180**: Render department tabs
```typescript
<div className="flex gap-2 flex-wrap">
  {departments.map((dept) => (
    <Button
      key={dept.id}
      variant={selectedDept === dept.id ? "default" : "outline"}
      onClick={() => {
        setSelectedDept(dept.id);  // Update selected department
        setPage(1);                 // Reset to first page
      }}
    >
      {dept.name}
    </Button>
  ))}
</div>
```

**Lines 200-250**: Render table with visits
```typescript
<DataTable 
  columns={[
    {
      header: "Token",
      accessor: "visitNumber",
      cell: (visit) => <div>{visit.visitNumber}</div>
    },
    {
      header: "Patient",
      accessor: "patient",
      cell: (visit) => (
        <div>
          {visit.patient.firstName} {visit.patient.lastName}
        </div>
      )
    },
    // ... more columns
  ]}
  data={visits}
/>
```

**Lines 250-280**: Action buttons
```typescript
{
  header: "Actions",
  cell: (visit) => (
    <div>
      {visit.status === "WAITING" && (
        <>
          <Button onClick={() => handleCheckIn(visit.id)}>
            Check-in
          </Button>
          <Button onClick={() => handleStartConsultation(visit.id)}>
            Consult
          </Button>
        </>
      )}
    </div>
  )
}
```

### ✅ Follow the component:
```bash
# Open file
code components/visits/opd-dashboard.tsx

# Read in this order:
# 1. Imports (lines 1-20)
# 2. Props interface (lines 35-40)
# 3. State declarations (lines 60-80)
# 4. fetchOPDVisits function (lines 85-110)
# 5. useEffect hook (lines 112-120)
# 6. Render method (lines 180+)

# Look for:
# - Where API is called: fetchApi()
# - How data is handled: setVisits()
# - How user interactions trigger updates: onClick handlers
```

---

## 📍 STEP 10: Test Security

### Can a user cross boundaries?

**Scenario**: Cardiology receptionist tries to access Orthopedics data

```typescript
// Cardiology receptionist's JWT token
SessionPayload {
  userId: "reception-123",
  tenantId: "tenant-001",
  departmentIds: ["cardio-123"],  // Only Cardiology!
  permissions: ["OPD_VIEW", "OPD_CREATE", "OPD_CHECKIN"]
}

// User clicks on Orthopedics tab (if it were there)
// Backend API filters:
GET /api/visits/opd?departmentId=ortho-456&page=1

// Security check in API:
if (!session.departmentIds.includes("ortho-456")) {
  return 403 Forbidden  // ← BLOCKED!
  message: "You are not assigned to this department"
}

// Result: User cannot access Orthopedics data
```

### ✅ Test this yourself:

```bash
# 1. Login as Cardiology receptionist
# Tenant: DEMO
# Username: receptionist
# Password: admin123

# 2. Open DevTools → Network
# 3. Navigate to OPD dashboard
# 4. Look at request: GET /api/visits/opd
# 5. Query params should include: departmentId=cardio-xxx

# 6. Try to manually craft request for Orthopedics
# Open console and run:
fetch('/api/visits/opd?departmentId=ortho-123')
  .then(r => r.json())
  .then(d => console.log(d))

# You should get:
# { error: "Access denied. Department not assigned to you" }
```

---

## 📊 SUMMARY TABLE

| Layer | File | Purpose |
|-------|------|---------|
| **DB Schema** | `prisma/schema.prisma` | Define UserDepartment table |
| **Auth** | `lib/auth.ts` | Add departmentIds to JWT |
| **Auth Login** | `app/api/auth/login/route.ts` | Fetch departments on login |
| **Service** | `lib/services/visits.ts` | 4 OPD functions |
| **API Create** | `app/api/visits/opd/create/route.ts` | Validate + create visit |
| **API List** | `app/api/visits/opd/route.ts` | Fetch + filter visits |
| **Component** | `components/visits/opd-dashboard.tsx` | Display dashboard |
| **Component** | `components/visits/opd-visit-create.tsx` | Create form |
| **Component** | `components/visits/doctor-queue.tsx` | Doctor queue |
| **Permissions** | `lib/constants/permissions.ts` | Define permissions |
| **Security** | `lib/middleware/department-access.ts` | Enforce access control |

---

## 🎯 Quick Navigation

```bash
# To understand USER assignment to departments:
grep -r "UserDepartment" lib/ app/ --include="*.ts" --include="*.tsx"

# To understand OPD visit creation:
grep -r "createOPDVisit" lib/ app/ --include="*.ts"

# To understand API validation:
grep -r "departmentId" app/api/visits/ --include="*.ts"

# To understand component data fetching:
grep -r "fetchApi" components/visits/ --include="*.tsx"

# To understand permission checks:
grep -r "OPD_" lib/ --include="*.ts"
```

---

## 🎓 Learning Path (30 minutes)

```
5 min:  Read DATABASE_SCHEMA.md section on UserDepartment
3 min:  View prisma/schema.prisma lines 200-230
5 min:  Read lib/auth.ts SessionPayload type
3 min:  View app/api/auth/login/route.ts lines 40-55
5 min:  Read lib/services/visits.ts function signatures
4 min:  View app/api/visits/opd/create/route.ts
2 min:  Quick scan components/visits/opd-dashboard.tsx
3 min:  Read OPD_QUICK_REFERENCE.md
```

**Total**: ~30 minutes to understand the complete flow!

---

**Ready?** Open the files and follow along! 🚀
