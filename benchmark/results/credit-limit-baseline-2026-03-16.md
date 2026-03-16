# Credit Limit Benchmark — Baseline Results (Before Spec Change)

**Date**: 2026-03-16
**Target**: `app-sales` (unmodified baseline, port 3001)
**Test file**: `credit-limit.test.ts` (4 tests)

## Results: 1/4 PASS

| # | Test | Result | Reason |
|---|------|--------|--------|
| 1 | 与信超過で注文拒否 | FAIL | 超過時も HTTP 200 で注文成功（warning flag のみ） |
| 2 | 入金後に与信回復（3モジュール横断） | FAIL | 同上（拒否されないため回復テストも不成立） |
| 3 | 未払い残高フィールド | FAIL | outstanding_balance 未実装 |
| 4 | credit_limit=0 チェック無効 | PASS | 巨額注文が通る（既存動作） |

## 解釈

Test 1-3 の FAIL は**期待通り**。変更後仕様書（`specs/sales-after-credit/`）を適用したアプリでのみ PASS するべきテスト。
