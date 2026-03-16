# Code Generation Prompt — BtoB Sales Management System

> This file records the exact prompt given to the AI for code generation.
> Date: 2026-03-14
> Model: Claude Sonnet 4.6
> Input: 8 specification files (2,708 lines total)

---

## Prompt

You are building a complete BtoB Sales Management System as a Next.js application.

### Tech Stack
- Next.js (App Router, TypeScript)
- Tailwind CSS for styling
- SQLite via better-sqlite3 for database
- No authentication (framework-delegated per spec)

### Input Specifications
Read ALL of the following specification files carefully before writing any code:
- `00_sip_analysis.md` — Screen-Input-Process analysis (system overview)
- `01_master_data.md` — Master data definitions (fixed/reference data)
- `02_persistent_data.md` — Persistent data definitions (transaction data)
- `03_screen_data.md` — Screen data definitions (temporary/in-memory data)
- `101_order_spec.md` — Order Management Module (Screens 1-4)
- `102_inventory_shipping_spec.md` — Inventory & Shipping Management Module (Screens 5-8)
- `103_billing_payment_spec.md` — Invoice & Payment Management Module (Screens 9-12)
- `104_master_spec.md` — Master Management Module (Screens 13-15)

### Architecture Requirements

1. **Database layer** (`src/lib/db.ts`):
   - SQLite schema matching ALL tables from `01_master_data.md` and `02_persistent_data.md`
   - Include all CHECK constraints, FOREIGN KEYs, and UNIQUE constraints from the spec
   - Seed data for demonstration (categories, sample products, sample customers, system settings)

2. **Type definitions** (`src/types/index.ts`):
   - TypeScript interfaces for all data structures
   - API response types with proper error typing

3. **API routes** — One route file per resource, following Next.js App Router conventions:
   - Implement ALL processes defined in §2 (Decision Processing) and §3 (Data Update Processing) of each spec
   - Return proper HTTP status codes (200, 201, 400, 404, 409, 500)
   - Return structured error responses: `{ error: string, field?: string }`
   - Implement ALL validation rules from §2 (guard conditions, input validation, duplicate checks)

4. **Page components** — One page per screen (15 screens total):
   - Implement ALL display logic from §4 (UI Hook) of each spec
   - Client-side form validation matching server-side rules
   - Loading states during API calls
   - Success/error toast notifications
   - Proper form reset after save operations
   - Currency formatting (¥X,XXX) as specified
   - Status badges with appropriate colors
   - Disabled states for buttons per spec conditions

5. **Navigation**:
   - Sidebar with module grouping (Order Management, Inventory & Shipping, Invoice & Payment, Master Management)
   - Active state indication

### Quality Requirements (Important)

- Implement EVERY validation rule from the specs — do not skip any guard condition or input check
- Every API error should return a meaningful message matching the spec's error text
- Forms should show field-level validation errors
- Include try-catch error handling on all API routes
- Loading spinners during async operations
- Confirmation dialogs for destructive operations (delete, cancel)
- Properly handle edge cases (empty lists, zero amounts, boundary values)

### What NOT to do

- Do not add authentication/login
- Do not add features not in the spec
- Do not use an ORM — use raw SQL with better-sqlite3
- Do not create a separate backend server — use Next.js API routes
