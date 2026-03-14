# Benchmark Result: Spec-Driven vs Vibe Coding

**Date:** 2026-03-14
**Subject:** Salon Reservation System — Tiered Cancellation Policy Change

---

## Summary

| | app-spec (仕様書ベース) | app-vibe (ざっくり指示) |
|---|:---:|:---:|
| **Test result** | **7/7 PASS** | **1/7 PASS** |
| Build success | Yes | Yes |
| Manual fix required | 0 lines | — |

---

## Test Results

| # | Test | app-spec | app-vibe |
|---|---|:---:|:---:|
| 1 | Cancel 72h+ before → fee = ¥0, no penalty | PASS | FAIL |
| 2 | Cancel 24–72h before → fee = 50% of total price, penalty +1 | PASS | FAIL |
| 3 | Cancel < 24h before → fee = 100% of total price, penalty +1 | PASS | FAIL |
| 4 | No-show → fee = 100% of total price, penalty +1 | PASS | FAIL |
| 5 | Modification cancels old reservation with fee = ¥0, no penalty | PASS | FAIL |
| 6 | cancellation_fee field exists on reservation records | PASS | FAIL |
| 7 | Customer at penalty limit cannot create new reservations | PASS | PASS |

---

## Specification Change

**Before (binary):**
- < 24h before reservation = penalty count +1
- ≥ 24h = no penalty
- No cancellation fee tracking

**After (tiered):**
- Cancellation Policy master table: `{hour_threshold, cancellation_rate}` pairs
- Default tiers: <24h = 100%, <72h = 50%, ≥72h = 0%
- `cancellation_fee` column on reservations (actual amount in yen)
- Penalty increment only when cancellation_rate > 0%
- No-show = 100% fee always
- Modification = fee 0, no penalty

---

## What Each Version Did

### app-spec (from 6-file specification)

- Added `cancellation_policy` master table with `tier_id`, `hour_threshold`, `cancellation_rate`
- Added `cancellation_fee` column (INTEGER, yen) to `reservations` table
- Implemented tier scanning in ascending `hour_threshold` order per spec §2-9
- Calculated fee as `sum(price_at_booking) × rate / 100` (floor)
- Recorded fee amount on cancel and no-show
- Penalty increment gated on `cancellation_rate > 0%`
- Added `cancel_preview` endpoint for confirmation dialog
- Added `cancellation-policy` API endpoint for tier listing
- Updated UI: cancel confirmation dialog, policy display on reservation screen, admin fee display

### app-vibe (from natural language instruction)

Instruction given:
> 「このサロン予約アプリのキャンセルポリシーを段階制に変更してほしい。今は当日キャンセルかどうかの二択だけど、72時間以上前なら無料、24〜72時間前なら50%、24時間未満なら100%のキャンセル料がかかるようにしたい。ノーショーは100%。予約変更の場合はキャンセル料なし。」

- Added tier settings to `system_settings` (6 key-value pairs instead of a master table)
- Added `cancellation_fee_rate` column (rate %, not amount) to `reservations` table — **NOT `cancellation_fee`**
- Implemented tier calculation logic (functionally correct)
- Added `cancel_preview` endpoint
- Updated UI with cancel confirmation dialog and policy display

---

## Root Cause of Failure

**The vibe version stored the cancellation fee *rate* (%) instead of the fee *amount* (¥).**

Both versions understood the tiered logic correctly. The difference was in **data structure design**:

| Design decision | app-spec | app-vibe |
|---|---|---|
| Policy storage | Dedicated master table (`cancellation_policy`) | 6 key-value pairs in `system_settings` |
| Fee recording | `cancellation_fee` = amount in yen (¥2,250) | `cancellation_fee_rate` = percentage (50) |
| Fee calculation | At cancel time, compute & store amount | At cancel time, compute & store rate only |

The spec explicitly defined `cancellation_fee` as `0–999999` (yen amount) in `02_persistent_data.md`. Without this specification, the vibe version made a reasonable but different design choice — storing the rate instead of the amount. This single data structure decision caused 6 of 7 tests to fail.

---

## Key Takeaway

> Both AIs understood *what* to do. The difference was *how* they structured the data.
> Without a specification, the AI made a reasonable but incompatible design choice.
> With a specification, the data structure was deterministic.

**"The spec doesn't tell the AI what to think — it tells the AI what data to produce."**

---

## Reproduction

```bash
# Start app-spec
cd benchmark/app-spec && rm -f salon.db && npx next start -p 3097

# Start app-vibe
cd benchmark/app-vibe && rm -f salon.db && npx next start -p 3098

# Run tests (edit .env.test to switch target)
cd benchmark/tests
echo "BASE_URL=http://localhost:3097" > .env.test  # or 3098
npx vitest run --reporter=verbose
```

---

## Environment

- Model: Claude Opus 4.6 (claude-opus-4-6) — both spec and vibe agents
- Framework: Next.js 16.1.6, TypeScript, SQLite (better-sqlite3)
- Test framework: Vitest 3.2.4
- Baseline app: 13 API routes, 6 screens, generated from before-spec in a single pass
