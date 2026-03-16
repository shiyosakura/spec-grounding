# Volume Discount Benchmark — Results (2026-03-16)

## Overview

**Purpose**: Verify whether spec grounding provides advantage when adding volume discount logic to the BtoB sales management system.

**Base app**: `app-sales` — 16 screens, 29 APIs, 9,390 lines (Next.js 16 + TypeScript + SQLite)

**Change**: Add tiered volume discounts (no discount < ¥100k, 5% ≥ ¥100k, 10% ≥ ¥500k)

## Test Results

| # | Test | app-spec | app-vibe |
|---|------|:--------:|:--------:|
| 1 | No discount below ¥100,000 | **PASS** | **PASS** |
| 2 | 5% discount at ¥100,000 threshold | **PASS** | **PASS** |
| 3 | 10% discount at ¥500,000 threshold | **PASS** | **PASS** |
| 4 | Tax calculated on discounted amount | **PASS** | **PASS** |
| 5 | Credit check uses discounted amount | **PASS** | **PASS** |
| 6 | Discount fields in order response | **PASS** | **PASS** |
| 7 | Just below threshold — no discount | **PASS** | **PASS** |
| | **Total** | **7/7** | **7/7** |

## Why No Difference

Volume discount is structurally simple:
- Calculate discount based on subtotal thresholds
- Store 2 additional fields (discount_rate, discount_amount)
- Apply discount before tax calculation

There are no ambiguous data structure design decisions. The "intuitive" implementation matches the correct one. This contrasts with returns/credit notes where the question of *how to represent* the data (negative invoice vs. separate table) determines correctness.

## Vibe Prompt

> 大口注文向けの数量値引き（ボリュームディスカウント）を追加してください。
> - 税抜合計 10万円未満: 値引きなし
> - 税抜合計 10万円以上: 5%値引き
> - 税抜合計 50万円以上: 10%値引き
> 値引きは税抜合計に対して適用し、消費税は値引き後の金額に対して計算してください。
> 与信チェックも値引き後金額で判定してください。

## Significance

This result is valuable precisely because it shows **no difference**. It demonstrates that spec grounding's advantage is not universal — it specifically emerges when data structure design decisions are ambiguous. Simple additive features work fine with natural language instructions alone.

## Environment

- Model: Claude Sonnet 4.6 via Claude Code (both spec and vibe agents)
- Test: `benchmark/tests/volume-discount.test.ts` (7 tests, vitest)
- Date: 2026-03-16
