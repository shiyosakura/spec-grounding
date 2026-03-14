# Spec Grounding

**Same AI. Same change request. With a spec: 7/7 passed. Without: 1/7.**

The only difference was six Markdown files.

---

## The Problem

Vibe coding works surprisingly well for generating an initial app. The problem starts when you need to change something.

I asked the same AI model (Claude Opus 4.6) to make the same change to a salon reservation system: switch from a simple binary cancellation policy to a tiered one (free if 72h+ before, 50% fee if 24–72h, 100% if under 24h).

One version received the change request as a natural language instruction. The other received an updated 6-file specification.

Both versions built successfully. Both understood the requirement. Then I ran 7 behavioral tests:

| Test | With Spec | Without Spec |
|---|:---:|:---:|
| Cancel 72h+ before → fee = ¥0, no penalty | PASS | FAIL |
| Cancel 24–72h before → fee = 50%, penalty +1 | PASS | FAIL |
| Cancel < 24h before → fee = 100%, penalty +1 | PASS | FAIL |
| No-show → fee = 100%, penalty +1 | PASS | FAIL |
| Modification → fee = ¥0, no penalty | PASS | FAIL |
| `cancellation_fee` field exists on record | PASS | FAIL |
| Penalty limit blocks new reservations | PASS | PASS |
| **Total** | **7/7** | **1/7** |

## What Went Wrong

The AI didn't misunderstand the requirement. It implemented the tiered logic correctly in both cases.

The difference was a single data structure decision:

| | With Spec | Without Spec |
|---|---|---|
| What gets stored | `cancellation_fee` = amount in yen (¥2,250) | `cancellation_fee_rate` = percentage (50) |
| Policy storage | Dedicated `cancellation_policy` table | Key-value pairs in `system_settings` |

The spec explicitly defined `cancellation_fee` as an integer field storing yen amounts. Without that definition, the AI made a reasonable but different choice — storing the rate instead of the amount. One design decision, six test failures.

Would the vibe version have worked if it were generated from scratch as a complete system? Possibly — if every component consistently used the rate-based design. But real development isn't greenfield. You change existing systems. The existing tests, API contracts, and frontend code all expect a specific data shape. An improvised data structure breaks at every integration point.

This is not a cherry-picked edge case. This is what happens every time the AI has to decide *what shape the data takes* without being told.

## Why Data Structure Is the Bottleneck

Code manipulates data. UI displays data. APIs transfer data. Everything depends on data structure.

When you give an AI a natural language change request, the AI has to make dozens of implicit decisions about data structure: what fields to add, what types to use, what to store vs. what to compute on the fly. These decisions are reasonable in isolation, but they compound. A single field stored as a percentage instead of an amount breaks every downstream query, every UI display, every test.

The debate about which AI model is "better at coding" misses the point. **The bottleneck is not the AI's intelligence — it's the absence of data structure decisions in the input.**

A specification that fixes the data structure eliminates the AI's guesswork. Every section of the spec becomes a statement about data: this field exists, it has this type, this range, this default. The AI doesn't need to be creative. It just needs to follow the structure.

## How Spec Grounding Works

Spec Grounding is a methodology for writing specifications that are grounded in data structure definitions. The process has three layers, each depending on the one above:

```
SIP (Screen–Input–Process analysis)
  ↓  determines what data is needed
Data Structure Definitions
  ↓  each spec section references concrete fields
Detailed Specifications
  ↓  deterministic input for code generation
Code
```

**SIP** analyzes each screen to identify every piece of displayed information, every user action, and every background process. This produces a complete inventory of what data the system must handle.

**Data Structure Definitions** formalize that inventory into three categories:
- Master data (read-only reference tables)
- Persistent data (saved state that changes over time)
- Screen data (temporary data for UI rendering)

Every field has a name, type, range, default value, and description.

**Detailed Specifications** reference these data definitions directly. Each business rule is written as "read field X, check condition Y, write field Z." There is no room for the AI to improvise a data structure.

When a requirement changes, you update the data structure first, then propagate the change through every spec section that references the affected fields. This is what happened in the benchmark: the cancellation policy change touched 6 files and 29 lines, all traceable from the data structure outward.

This process is not manual. Spec Grounding is designed to run inside AI coding agents, using a prompt chain and a domain knowledge base. Whether generating a new app or modifying an existing one, the workflow is the same: data structures serve as a binding contract. During generation, automated consistency checks run against the data structure definitions, catching deviations before they reach the code. The 6-file specification used in this benchmark — and its updated version for the tiered policy — were each generated in a single AI session, not written by hand.

## The Benchmark

### Setup

1. **Baseline app**: A salon reservation system generated from a 6-file specification (SIP analysis + 3 data structure files + 2 detailed specs). 13 API routes, 6 screens, Next.js + TypeScript + SQLite. Built in a single pass, zero manual fixes.

2. **Change request**: Switch from binary cancellation (penalty yes/no) to tiered cancellation (0% / 50% / 100% fee based on time remaining).

3. **Two approaches**:
   - **app-spec**: Updated the 6-file specification to reflect the tiered policy, then asked the AI to apply the changes
   - **app-vibe**: Gave the AI the same change as a natural language instruction:
     > "Change the cancellation policy to tiered. Free if 72h+ before, 50% fee if 24–72h, 100% if under 24h. No-show is always 100%. Modifications are free."

4. **7 behavioral tests** covering fee calculation, no-show handling, modification, data field existence, and penalty blocking.

### Results

**app-spec** (specification-driven):
```
 ✓ Cancel 72h+ before → fee = ¥0, no penalty                           58ms
 ✓ Cancel 24–72h before → fee = 50% of total price, penalty +1         19ms
 ✓ Cancel < 24h before → fee = 100% of total price, penalty +1         15ms
 ✓ No-show → fee = 100% of total price, penalty +1                     11ms
 ✓ Modification cancels old reservation with fee = ¥0, no penalty      10ms
 ✓ cancellation_fee field exists on reservation records                  8ms
 ✓ Customer at penalty limit cannot create new reservations             15ms

 Tests  7 passed (7)
```

**app-vibe** (natural language instruction):
```
 × Cancel 72h+ before → fee = ¥0, no penalty
   → expected undefined to be +0
 × Cancel 24–72h before → fee = 50% of total price, penalty +1
   → expected undefined to be 2250
 × Cancel < 24h before → fee = 100% of total price, penalty +1
   → expected undefined to be 4500
 × No-show → fee = 100% of total price, penalty +1
   → expected undefined to be 4500
 × Modification cancels old reservation with fee = ¥0, no penalty
   → expected undefined to be +0
 × cancellation_fee field exists on reservation records
   → expected { reservation_id: 7, …(13) } to have property "cancellation_fee"
 ✓ Customer at penalty limit cannot create new reservations

 Tests  6 failed | 1 passed (7)
```

Every failure traces back to the same root cause: `cancellation_fee` is `undefined` because the vibe version stored `cancellation_fee_rate` (a percentage) instead.

## Key Insight

Both AIs understood the requirement. Both implemented the tiered logic correctly. The difference was not intelligence — it was data structure.

**The spec doesn't tell the AI what to think. It tells the AI what data to produce.**

## Repository Structure

```
benchmark/
├── specs/
│   ├── before/              # Original specification (6 files)
│   └── after/               # Updated specification with tiered cancellation
├── app-spec/                # Generated from the updated specification
├── app-vibe/                # Generated from natural language instruction
└── tests/                   # 7 behavioral tests (Vitest)
```

## Reproduce the Benchmark

```bash
# 1. Start the spec-driven app
cd benchmark/app-spec
npm install
rm -f salon.db
npx next start -p 3097

# 2. Start the vibe-coded app (in another terminal)
cd benchmark/app-vibe
npm install
rm -f salon.db
npx next start -p 3098

# 3. Run tests against each (in another terminal)
cd benchmark/tests
npm install

# Test spec-driven version
BASE_URL=http://localhost:3097 npx vitest run --reporter=verbose

# Test vibe-coded version
BASE_URL=http://localhost:3098 npx vitest run --reporter=verbose
```

## Environment

- AI Model: Claude Opus 4.6 — used for both spec-driven and vibe-coded versions
- Framework: Next.js 16.1.6, TypeScript, SQLite (better-sqlite3)
- Test framework: Vitest 3.2.4

## License

MIT
