# HMS App - AI Copilot Instructions

## Architecture Overview

**Multi-tenant Hospital Management System** (Next.js 16 + Prisma 7 + PostgreSQL)

The app serves two distinct user roles via separate login flows:
- **Super Admin** (`/superadmin/login`): Platform-level management (tenants, licenses)
- **Tenant Users** (`/login`): Hospital/clinic staff managing departments, patients, consultations

**Tenant Isolation**: All data filtered by `tenantId` at the model level (Prisma relations enforce boundaries).

### Key Service Boundaries

| Domain | Files | Responsibility |
|--------|-------|-----------------|
| **Auth & Sessions** | `lib/auth.ts`, `middleware.ts`, `app/api/auth/**` | JWT tokens (7d expiry), bcrypt password hashing, role-based access |
| **RBAC** | `lib/rbac.ts`, `lib/services/roles.ts` | Permission inheritance, ADMIN role grants all permissions |
| **Patient Workflow** | `lib/services/patients.ts`, `appointments.ts`, `consultations.ts`, `vitals.ts`, `prescriptions.ts` | UHID generation, clinical encounters, medical records |
| **Audit & Compliance** | `lib/audit.ts` | Entity-level change tracking with `performedBy`, `oldValue`, `newValue` |
| **Forms & Validation** | `lib/schemas/*.ts` | Zod schemas used in API routes and React forms |

### Data Flow Example: Patient Creation

```
1. Component: patient-form-drawer.tsx (uses react-hook-form)
   ↓ (POST /api/patients/create)
2. API Route: app/api/patients/[method]/route.ts
   ├─ Validate with Zod schema
   ├─ Check permission: users.permissions includes "PATIENT_CREATE"
   ├─ Generate UHID via lib/patient-utils.ts
   ├─ Create in DB with tenantId + audit log
   └─ Return ApiResponse { success, data, message }
3. Component catches ApiError, displays Toast
```

## Critical Developer Workflows

### Local Development
```bash
npm run dev              # Start Next.js (http://localhost:3000)
npm run db:migrate      # Run pending Prisma migrations
npm run db:seed         # Reset DB with test data (prisma/seed.ts)
npm run lint            # Run ESLint
npm run db:generate     # Regenerate Prisma client (after schema changes)
```

### Environment Setup
- **JWT_SECRET**: Must be ≥32 chars (checked in `lib/auth.ts`)
- **DATABASE_URL**: PostgreSQL connection (Prisma adapter-pg in use)
- Prisma client output: `app/generated/prisma/` (not `node_modules`)

### Common Error Patterns
- **401 Unauthorized**: Check JWT cookie (`hms_session` or `hms_superadmin_session`)
- **403 Forbidden**: Permission missing from user's role (verify in DB: User → UserRoles → RolePermissions)
- **Invalid tenant**: Tenant code uppercase, license not expired, tenant marked `isActive`

## Project-Specific Patterns

### 1. **API Response Standard**
All endpoints return:
```typescript
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  errorCode?: string;
}
```
Use `Response.json()` with 400/401/403/500 status codes.

### 2. **Permission Checks in API Routes**
```typescript
// Extract from session (middleware adds payload to request)
const { permissions } = session;
if (!permissions.includes("PATIENT_VIEW")) {
  return Response.json({ error: "Access denied" }, { status: 403 });
}
```

### 3. **Zod Validation Pattern**
- Define schema in `lib/schemas/*.ts`
- Use in API: `const data = PatientSchema.parse(body);`
- Use in components: `useForm<PatientFormData>({ resolver: zodResolver(PatientSchema) })`
- See `lib/schemas/patient-schema.ts` for structure

### 4. **Audit Logging**
Always log sensitive operations:
```typescript
import { createAuditLog } from "@/lib/audit";

await createAuditLog({
  tenantId,
  performedBy: userId,
  entityType: "PATIENT",
  entityId: patientId,
  action: "CREATE",
  newValue: patientData,
});
```

### 5. **Service Layer Pattern**
- `lib/services/*.ts` contains business logic
- Called from API routes (server-only)
- Example: `getPatients(tenantId, { page, limit, search })`
- Returns paginated results with `pagination: { page, limit, total }`

### 6. **Component Conventions**
- **Form drawers**: `patient-form-drawer.tsx` (uses Drawer + react-hook-form)
- **Data tables**: `DataTable.tsx` (Radix UI table wrapper)
- **Glass design**: `GlassCard.tsx` (Tailwind + framer-motion)
- **Toast notifications**: Imported via `useToast()` hook
- All forms client-side (`"use client"` at top)

### 7. **Multi-Tenant Query Pattern**
Every DB query must include tenant filter:
```typescript
prisma.patient.findMany({
  where: { tenantId, status: "ACTIVE" }
  // ↑ CRITICAL: Never omit tenantId filter
})
```

## External Dependencies & Integration Points

| Library | Usage |
|---------|-------|
| **jose** | JWT signing/verification (OIDC-compatible) |
| **react-hook-form** | Form state management with minimal re-renders |
| **zod** | Runtime schema validation |
| **@radix-ui** | Headless UI components (Dialog, Select, Tabs, Dropdown) |
| **tailwindcss** | Utility CSS with CVA for component variants |
| **framer-motion** | Page transitions (PageTransition component) |
| **bcryptjs** | Password hashing (12 rounds) |
| **prisma** | ORM with migration versioning |

## File Organization Quick Reference

```
lib/
├── auth.ts              → createTenantToken, hashPassword, verifyToken
├── rbac.ts              → getUserPermissionCodes, AppError class
├── audit.ts             → createAuditLog()
├── api-client.ts        → fetch wrapper for client components
├── services/            → Business logic (getPatients, createConsultation, etc)
└── schemas/             → Zod validation schemas

app/
├── (auth)/login/        → Tenant login page
├── superadmin/login/    → Super admin login
├── (tenant)/            → Protected tenant routes (dashboard, patients, etc)
└── api/                 → Route handlers grouped by entity type

components/
├── auth/                → LoginForm, TenantBranding
├── patients/            → PatientList, PatientFormDrawer, PatientSelector
├── clinical/            → ConsultationForm, PrescriptionForm, VitalsRecording
└── ui/                  → Radix-based primitives (Button, Dialog, Table, etc)
```

## Red Flags & Things to Avoid

- ❌ Querying without `tenantId` filter → Data leakage across tenants
- ❌ Hardcoding role checks → Use permission codes from DB instead
- ❌ Missing audit logs on entity modifications → Compliance violation
- ❌ Returning raw Prisma errors to client → Use AppError with errorCode
- ❌ Skipping Zod validation → Type safety not guaranteed at runtime

## Testing & Validation

The project uses ESLint (no test framework detected in package.json). Before committing:
```bash
npm run lint
npm run db:generate  # If schema.prisma changed
```

## Questions for Clarification

When uncertain about a requirement:
1. Check `prisma/schema.prisma` for data model relationships
2. Search `lib/services/*.ts` for similar patterns
3. Review `/app/api/` route handlers as reference implementations
4. Examine components in `components/` for UI patterns
