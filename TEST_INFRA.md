# E2E Test Infra: Autopost Laptop Zalo -> Facebook

## Test Philosophy
- Opaque-box, requirement-driven, derived directly from `ORIGINAL_REQUEST.md`.
- No dependency on implementation design internals; verifies through public HTTP API endpoints, DOM assertions, and browser headless automation.
- Methodology: Category-Partition + Boundary Value Analysis + Pairwise Combinatorial + Real-World Workload Testing.

## Feature Inventory Test Mapping
| # | Feature Area | Requirement Source | Tier 1 (Unit/Feature) | Tier 2 (Boundary) | Tier 3 (Cross-Feature) | Tier 4 (Workload) |
|---|--------------|--------------------|:---------------------:|:-----------------:|:----------------------:|:-----------------:|
| 1 | Web Dashboard & Slide 0 | ORIGINAL_REQUEST §R1 | ✓ (5 tests) | ✓ (5 tests) | ✓ (Pairwise) | ✓ (Full Flow) |
| 2 | Cockpit & Action Buttons | ORIGINAL_REQUEST §R1 | ✓ (5 tests) | ✓ (5 tests) | ✓ (Pairwise) | ✓ (Full Flow) |
| 3 | Backend API Endpoints | ORIGINAL_REQUEST §R2 | ✓ (5 tests) | ✓ (5 tests) | ✓ (Pairwise) | ✓ (Full Flow) |
| 4 | Facebook Graph API & Supabase | ORIGINAL_REQUEST §R2 | ✓ (5 tests) | ✓ (5 tests) | ✓ (Pairwise) | ✓ (Full Flow) |
| 5 | Chrome Extension Scripts & MV3 | ORIGINAL_REQUEST §R3 | ✓ (5 tests) | ✓ (5 tests) | ✓ (Pairwise) | ✓ (Full Flow) |
| 6 | Technical Syntax & HTTP Status | ORIGINAL_REQUEST §R4 | ✓ (5 tests) | ✓ (5 tests) | ✓ (Pairwise) | ✓ (Full Flow) |

## Test Architecture
- **Test Runner**: `node tests/e2e/test_runner.js [tier]`
  - Exit code 0: ALL tests pass
  - Exit code 1: Any assertion failure
- **Test Case Structure**:
  - `tests/e2e/tier1_features.test.js`: Feature-level test coverage (API response structure, default values, valid inputs)
  - `tests/e2e/tier2_boundaries.test.js`: Boundary cases (empty inputs, missing tokens, invalid IDs, malformed JSON)
  - `tests/e2e/tier3_pairwise.test.js`: Cross-feature combinations (Target both, multi-image posts, circular triggering)
  - `tests/e2e/tier4_realworld.test.js`: End-to-end user workflows (Zalo extract -> Queue -> Dual Channel Publish)

## Real-World Application Scenarios (Tier 4)
| # | Scenario | Features Exercised | Complexity |
|---|----------|--------------------|------------|
| 1 | Zalo Post Ingestion to Queue | Zalo Content Extract -> Push API -> Local/Supabase Store -> Queue Tab Render | High |
| 2 | Dual-Channel Publish Immediate | Cockpit/Queue Action Button -> Graph API v21.0 + Web Bridge Personal Robot | High |
| 3 | Circular Engine Autonomous Replenish | Trigger Circular -> Smart Template Fetch -> AI Rewrite -> Queue Insertion | High |
| 4 | Offline / Credential Fallback Graceful Handling | Missing Supabase / Bad Token -> Local file fallback -> User friendly JSON error | Medium |
| 5 | Slide 0 Navigation & Keyboard Lifecycle | Modal Open -> Marquee -> Keyboard Shortcuts [→]/[Space]/[Enter] -> Dashboard Active | Medium |

## Coverage Thresholds
- Tier 1: ≥ 25 feature-level assertions across all modules
- Tier 2: ≥ 25 boundary & error-handling assertions
- Tier 3: ≥ 10 pairwise interaction assertions
- Tier 4: ≥ 5 realistic application scenario assertions
- **Total Minimum**: ≥ 65 comprehensive assertions
