# 与信限度額ベンチマーク結果 (2026-03-16)

## 概要

BtoB販売管理アプリ（16画面/29API/9,390行）に対する仕様変更追従ベンチマーク。
「与信チェック厳格化」（warning → blocking + outstanding_balance追加）を題材に、Spec版・Vibe版の差を検証。

## 仕様変更内容

| 変更 | 内容 | 対象モジュール |
|------|------|---------------|
| 与信超過時の注文拒否 | warning flag → HTTP 400 + ロールバック | 注文管理 |
| 消込完了で与信枠回復 | 全額消込でinvoice status=3 → 与信計算から除外 | 請求・入金管理 |
| outstanding_balance追加 | GET /api/customers/[id] に計算フィールド追加 | マスタ管理 |

## テスト結果 (N=1)

| テスト | 内容 | Spec版 | Vibe版 |
|--------|------|--------|--------|
| Test 1 | 与信超過で注文拒否 | PASS | PASS |
| Test 2 | 入金後に与信回復（3モジュール横断） | PASS | PASS |
| Test 3 | 未払残高フィールド出現 | PASS | PASS |
| Test 4 | credit_limit=0でチェック無効 | PASS | PASS |
| Test 5 | 部分消込では与信未解放（保守的チェック） | PASS | **FAIL** |
| **合計** | | **5/5** | **4/5** |

## Test 5の差異分析

仕様書（§3-9）の与信チェック計算式:
> outstanding = Sum of `billing_amount` from invoices where status IN (1, 2)

- **Spec版**: 請求書の**全額**（billing_amount）を使用 → 部分消込後も ¥93,500 として計算
- **Vibe版**: 請求書の**残高**（billing_amount - reconciled）を使用 → 部分消込後 ¥43,500 として計算

仕様書は「保守的な与信判定」を意図的に選択しており、これは自然言語指示からは推測不可能なビジネス判断。

## 実装差異の詳細

### orders/route.ts — 与信チェック時の請求残高計算
```
Spec版: SELECT SUM(invoice_amount) ... WHERE status IN (1, 2)
Vibe版: SELECT SUM(invoice_amount - COALESCE(reconciled, 0)) ... WHERE status IN (1, 2)
```

### customers/[id]/route.ts — outstanding_balance の未請求注文スコープ
```
Spec版: orders WHERE status IN (0, 1, 2)      — 確定/出荷中/出荷済
Vibe版: orders WHERE status IN (0, 1, 2, 3)   — +請求済（二重カウントの可能性）
```
※ この差異は現テストでは検出されていない（NOT EXISTS句で実質的に除外されるため）

## 考察

### Test 1-4が両版で通った理由

1. **変更パターンが「よく知られたビジネスパターン」**: 「超過なら拒否」は一般的で、LLMが自然に実装できる
2. **既存コードに与信チェック骨格が存在**: warning → reject への変更は構造的変更が小さい
3. **Vibeプロンプトの曖昧さが不十分**: 「拒否する」「枠が解放される」「未払い残高を返す」は十分に明確
4. **テストがハッピーパスのみ**: 全額消込シナリオでは両版の計算式差異が露出しない

### サロン予約ベンチマーク（7/7 vs 1/7）との比較

| 要素 | サロン（キャンセル料） | BtoB（与信チェック） |
|------|----------------------|---------------------|
| ビジネスロジック | 固有の計算式（N日前50%等） | 一般的パターン（超過→拒否） |
| 既存コードとの距離 | ゼロから追加 | 既存骨格の修正 |
| Vibeプロンプトの曖昧度 | 高（日数・料率が不明） | 低（意図が明確） |
| テスト通過率差 | 6/7 | 1/5 |

### 示唆

- 「よく知られたパターン」の変更ではSpec版の優位性が出にくい
- 差が出るのは**固有のビジネス判断**（保守的vs直感的な計算式等）を含む変更
- テスト設計がベンチマーク結果に大きく影響する — エッジケースを突くテストが必要

## 環境

- モデル: Claude Sonnet 4.6, effort=medium
- フレームワーク: Next.js 16 + SQLite (better-sqlite3)
- アプリ規模: 16画面 / 29 API / 9,390行
- Vibe版プロンプト: 自然言語4文（意図的曖昧さ: outstanding_balance計算式、credit_limit=0バイパス、税込計算精度を未指定）
