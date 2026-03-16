# Returns & Credit Note Benchmark — Results (2026-03-16)

## Overview

**Purpose**: Verify that spec grounding produces correct returns processing when adding a complex cross-module feature (returns + credit notes + inventory restoration + reconciliation offset) to an existing BtoB sales management system.

**Base app**: `app-sales` — 16 screens, 29 APIs, 9,390 lines (Next.js 16 + TypeScript + SQLite)

**Change**: Add returns processing with credit note auto-generation (new feature, not present in base app)

## Test Results

| # | Test | app-spec | app-vibe |
|---|------|:--------:|:--------:|
| 1 | Full return → CN amount accuracy | **PASS** | FAIL |
| 2 | Partial return (3/10) → CN for 3 units only | **PASS** | FAIL |
| 3 | Inventory increases after return (physical_stock) | **PASS** | FAIL |
| 4 | Tax calculation precision (floor() per line) | **PASS** | FAIL |
| 5 | Return qty exceeding shipped qty → rejected | **PASS** | **PASS** |
| 6 | Cumulative returns cannot exceed shipped qty | **PASS** | FAIL |
| 7 | CN reduces customer outstanding balance | **PASS** | **PASS** |
| 8 | CN offsets invoice in reconciliation | **PASS** | FAIL |
| | **Total** | **8/8** | **2/8** |

## Vibe Prompt (Given to Both Versions' Base Model)

> 出荷済み商品の返品処理に対応してください。
> 返品が発生した場合、対象の出荷指示に対して返品数量を入力して返品を登録します。部分返品にも対応してください（10個出荷したうち3個だけ返品など）。
> 返品が登録されたら、以下を処理してください：
> - 在庫を戻す（実在庫数を返品数量分増やす）
> - 該当する請求書に対してクレジットノート（マイナスの請求書）を自動発行する。金額は「返品数量 × 元の受注時の単価 + 消費税」で計算してください。
> - クレジットノートは消込画面で入金と同じように請求書と相殺できるようにしてください。
> - 顧客の未払残高（outstanding_balance）にもクレジットノートを反映してください。
> 返品のAPIは `POST /api/returns` で、shipping_instruction_id と返品明細（商品ID、数量）を受け取る形でお願いします。

## Spec Version — What the Specification Clarified

The specification changes affected 5 files (02_persistent_data.md, 03_screen_data.md, 102_inventory_shipping_spec.md, 103_billing_payment_spec.md, 00_sip_analysis.md) and explicitly defined:

1. **CN stored in `invoices` table** with `invoice_amount` as a **negative value** and `status=4` (credit note) — no new table needed
2. **Tax calculation**: `floor(qty × unit_price × tax_rate / 100)` **per line item**, not on total
3. **Cumulative return validation**: sum of all prior returns + new return ≤ shipped quantity
4. **Reconciliation**: CN (status=4) appears in existing unreconciled invoice list, usable as offset
5. **Return allowed without prior invoice** — CN is auto-generated regardless of invoicing state
6. **Invoice.Return ID** field links CN back to the originating return

## Vibe Version — Root Causes of Failure

### Failure 1: Separate `credit_notes` table (Tests 1, 2, 4, 8)

The vibe version created 5 new tables (`returns`, `return_items`, `credit_notes`, `credit_note_items`, `credit_note_reconciliations`) instead of reusing the existing `invoices` table with negative amounts. This means:

- `GET /api/invoices` does not return credit notes → tests looking for `invoice_amount < 0` or `status === 4` find nothing
- The existing `payment-reconciliation` flow cannot offset invoices with credit notes
- A completely separate `/api/credit-note-reconciliation` endpoint was created, which the tests don't call

**Impact**: 4 tests fail because the data structure design diverged from what the business process requires.

### Failure 2: Return requires existing invoice (Tests 1, 2, 6)

The vibe version added a guard: "No invoice found for the order... Please issue an invoice first." (line 209-213 of returns/route.ts). This blocks returns registration when no invoice has been issued yet.

The spec version allows returns regardless of invoicing state — the CN is generated as a standalone negative invoice.

**Impact**: 3 tests fail because the test creates orders, ships them, then immediately registers returns without issuing invoices first.

### Failure 3: Tax calculated on total, not per line (Test 4)

```
// Vibe: Math.floor(subtotal * taxRate / 100) — total-level
// Spec: Σ(floor(qty × unit_price × taxRate / 100)) — per-line
```

For single-line returns, these produce the same result. For multi-line returns with non-round amounts, the per-line floor() produces different (correct) amounts.

**Impact**: Test 4 specifically tests non-round tax calculation (7 × ¥73 = ¥511, tax = floor(51.1) = ¥51).

### Failure 4: Outstanding balance as stored column with CHECK >= 0 (Test 7 — passed, but fragile)

The vibe version added `outstanding_balance INTEGER NOT NULL DEFAULT 0` with `CHECK (outstanding_balance >= 0)` to the `customers` table. This works for Test 7 but would fail if a credit note exceeds the outstanding balance (the CHECK constraint would reject it).

The spec version calculates outstanding balance dynamically from `SUM(invoice_amount)` where `status IN (1, 2, 4)`, which naturally handles negative values.

## Key Insight

The vibe prompt explicitly says "クレジットノート（マイナスの請求書）" — "credit note (negative invoice)." Even with this hint, the vibe version created a separate `credit_notes` table instead of storing negative amounts in the existing `invoices` table. The AI understood the *concept* of a negative invoice but chose a different *data structure* to represent it.

This mirrors the salon reservation benchmark finding: "The difference is not in understanding — it's in what data structure to use."

## Build Results

| | app-spec | app-vibe |
|---|:---:|:---:|
| Build | Success (first try) | Success (after 1 fix*) |
| Test | **8/8 PASS** | **2/8 PASS** |

*Vibe version had a seed/migration conflict (duplicate system_settings keys) and a missing `force-dynamic` export. Both were trivially fixable build issues, not business logic bugs.

## Environment

- Model: Claude Sonnet 4.6 via Claude Code (both spec and vibe agents)
- Base app: `benchmark/app-sales/` (BtoB Sales Management System)
- Spec files: `benchmark/specs/sales-after-returns/` (8 files)
- Test: `benchmark/tests/returns.test.ts` (8 tests, vitest)
- Date: 2026-03-16
