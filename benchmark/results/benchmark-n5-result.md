# N=5 ベンチマーク結果: サロン予約キャンセルポリシー変更

**実施日**: 2026-03-15
**テスト項目**: 7テスト（段階制キャンセル料3件 + No-Show + 変更 + データ存在 + ペナルティブロック）

## 実験概要

サロン予約システムの「段階制キャンセルポリシー変更」（二段階→三段階料金）を、仕様書ありコード生成（Spec）と自然言語のみコード生成（Vibe）で各5回独立実行し、テスト通過率の再現性を検証。

### 変更内容（Before → After）
- **Before（二値判定）**: 24時間未満 = ペナルティ、24時間以上 = 無料、料金追跡なし
- **After（三段階）**: 24時間未満 = 100%課金、24-72時間 = 50%課金、72時間以上 = 0%課金

## 結果サマリー

| Trial | Spec (Pass/Total) | Vibe (Pass/Total) |
|-------|-------------------|-------------------|
| 1     | **7/7** (100%)    | 1/7 (14%)         |
| 2     | **7/7** (100%)    | 1/7 (14%)         |
| 3     | **7/7** (100%)    | 1/7 (14%)         |
| 4     | **7/7** (100%)    | 1/7 (14%)         |
| 5     | **7/7** (100%)    | 1/7 (14%)         |
| **平均** | **7.0/7 (100%)** | **1.0/7 (14%)**  |

### Spec版: 5/5 全試行 ALL GREEN（分散ゼロ）
### Vibe版: 5/5 全試行 1/7（分散ゼロ）

## テスト別詳細

| # | テスト名 | Spec (5試行) | Vibe (5試行) |
|---|---------|-------------|-------------|
| 1 | Cancel 72h+ → fee=¥0, no penalty | 5/5 PASS | 0/5 (undefined) |
| 2 | Cancel 24-72h → fee=50%, penalty+1 | 5/5 PASS | 0/5 (undefined) |
| 3 | Cancel <24h → fee=100%, penalty+1 | 5/5 PASS | 0/5 (undefined) |
| 4 | No-show → fee=100%, penalty+1 | 5/5 PASS | 0/5 (undefined) |
| 5 | Modification → fee=¥0, no penalty | 5/5 PASS | 0/5 (undefined) |
| 6 | cancellation_fee field exists | 5/5 PASS | 0/5 (property missing) |
| 7 | Penalty blocking (3回キャンセル→予約拒否) | 5/5 PASS | 5/5 PASS |

## 失敗パターン分析

### Vibe版の共通失敗原因
全5試行で同一の失敗パターン:
- **`cancellation_fee` フィールドが存在しない**: Vibe版は全て `cancellation_fee_rate`（パーセンテージ）を返し、円額の `cancellation_fee` フィールドを持たない
- **データ構造の乖離**: 仕様書が定義する「金額ベースの手数料記録」をVibe版は「率ベース」で実装。フィールド名・値の単位が異なる

### Vibe版で唯一PASSしたテスト
- **Penalty Blocking**: キャンセル回数カウント→予約拒否のロジックは全Vibe版が正しく実装。これは仕様変更前（Before）のロジックと同一のため

## Vibe版各Trialのデータ構造設計

| Trial | cancellation_feeの保存形式 | ポリシー格納先 |
|-------|--------------------------|--------------|
| 1 | `cancellation_fee_rate` (%) | system_settings KV |
| 2 | `cancellation_fee_rate` (%) | system_settings (threshold_hours) |
| 3 | 別テーブル `cancellation_fee_logs` (fee_rate, fee_amount) | system_settings |
| 4 | `cancellation_fee_rate` (%) | system_settings |
| 5 | `cancellation_fee_rate` (%) | system_settings (tier式) |

**共通パターン**: 5/5が `cancellation_fee_rate`（%）を選択。`cancellation_fee`（円額）を実装したものは0/5。

## 結論

1. **Spec版は100%再現性**: 同一仕様書からの生成は5回全てで完全なテスト通過（7/7）
2. **Vibe版は一貫して失敗**: 自然言語指示のみでは、データ構造レベルの仕様（フィールド名・値の単位）が仕様と乖離し、5回全てで6/7テスト失敗
3. **分散ゼロ**: 両グループとも試行間のばらつきがなく、結果は決定論的
4. **データ構造が根本原因**: Vibe版の失敗は全て「cancellation_feeフィールドの不在」に起因。ロジック（ペナルティブロック）は全試行で正しく実装されており、データ構造定義の有無が品質差の決定要因
