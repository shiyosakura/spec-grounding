# BtoB Sales Management System — Generation Benchmark

**Date:** 2026-03-14
**Model:** Claude Sonnet 4.6
**Input:** 8 specification files, 2,708 lines total

---

## Summary

| Metric | Salon Reservation (previous) | **BtoB Sales Management** | Scale |
|---|:---:|:---:|:---:|
| Spec files | 6 | **8** | 1.3x |
| Spec lines | ~800 | **2,708** | 3.4x |
| Screens | 6 | **16** | 2.7x |
| API routes | 13 | **29** | 2.2x |
| Source files | ~25 | **51** | 2.0x |
| Code lines | 2,861 | **9,390** | **3.3x** |
| Build result | 1st pass success | **1st pass success** | — |
| Manual fixes | 0 | **0** | — |

---

## Specification Files

| File | Lines | Description |
|---|---:|---|
| 00_sip_analysis.md | 801 | Screen-Input-Process analysis |
| 01_master_data.md | 39 | Master data definitions |
| 02_persistent_data.md | 101 | Persistent/transaction data definitions |
| 03_screen_data.md | 44 | Screen (temporary) data definitions |
| 101_order_spec.md | 542 | Order Management Module (Screens 1–4) |
| 102_inventory_shipping_spec.md | 370 | Inventory & Shipping Module (Screens 5–8) |
| 103_billing_payment_spec.md | 375 | Invoice & Payment Module (Screens 9–12) |
| 104_master_spec.md | 436 | Master Management Module (Screens 13–15) |
| **Total** | **2,708** | |

---

## Generated Application

**Tech stack:** Next.js 16.1.6 (App Router), TypeScript, Tailwind CSS, SQLite (better-sqlite3)

### 4 Modules, 16 Screens

| Module | Screens | API Routes |
|---|---|---|
| Order Management | Quotation List, Quotation Create/Edit, Order List, Order Detail | 9 |
| Inventory & Shipping | Inventory List, Shipping Instruction List, Shipping Work, Receiving | 6 |
| Invoice & Payment | Invoice List, Invoice Issuance, Payment Registration, Payment Reconciliation | 7 |
| Master Management | Product Management, Customer Management, Special Price Master | 8 |
| — | Dashboard | 1 |
| **Total** | **16 screens** | **29 routes** (+ 2 shared components) |

### Implementation Quality

- All §2 validation rules implemented (guard conditions, input validation, duplicate checks)
- All §3 data operations implemented (correct execution order per Rule 14)
- All §4 display rules implemented (currency formatting, status badges, disabled states)
- Client-side + server-side validation
- Toast notifications for success/error feedback
- Confirmation dialogs for destructive operations
- Loading states during async operations
- Credit check with outstanding balance calculation
- Product name snapshots at quotation/order/invoice time
- Closing day logic (end-of-month / specific day)
- Payment reconciliation with cascading status updates

---

## Key Takeaway

> The same spec-grounding methodology that produced a 6-screen salon reservation system
> scales to a 16-screen, 29-API BtoB sales management system — 3.3x the code volume —
> with zero manual fixes. The specification structure (SIP → Data Definitions → Detailed Specs)
> maintains consistency across modules because every process references the same data definitions.

---

## Reproduction

```bash
cd benchmark/app-sales
npm install
rm -f sales.db
npx next dev -p 3100
```

## Generation Prompt

See `benchmark/generation_prompt.md` for the exact instructions given to the AI.

## Environment

- Model: Claude Sonnet 4.6
- Framework: Next.js 16.1.6, TypeScript, SQLite (better-sqlite3)
- Generation: 4 modules generated in parallel, foundation layer generated first
