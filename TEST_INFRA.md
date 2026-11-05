# E2E Test Infrastructure Specification: DATA POST & Circular Post Engine

## 1. Test Philosophy: Opaque-Box & Requirement-Driven

The end-to-end (E2E) testing framework for **Tab "DATA POST" & Circular Post Engine** operates under an **opaque-box, specification-driven** testing philosophy. Tests treat the system under test (SUT) as an external service, interacting solely through observable boundaries:
- **HTTP/REST Endpoints** (`/api/data-post/*`, `/`, `/index.html`)
- **JSON Request / Response Payloads** and HTTP status codes (200, 201, 400, 404, 409, 500)
- **HTML DOM Structure & Design System Tokens** in `public/index.html` (Neo-Brutalist elements, Slide 0 pure monochrome preservation)
- **Zero Blind Trust (ZBT)**: Verification of actual response status codes, payload shapes, data mutations, deduplication logic, and security edge cases (XSS, SQL injection strings).

Expected outputs are derived strictly from authoritative specifications:
1. `ORIGINAL_REQUEST.md` (R1: Tab Data Post UI, R2: Model Template & Supabase Storage, R3: Smart Match & Circular Engine, R4: Express Backend APIs)
2. `PROJECT.md` (Interface Contracts M1 ↔ M2, M1 ↔ M3, Feature Inventory, Milestones)
3. User Aesthetic & Design Directives (Slide 0 pure monochrome `#000000` / `#FFFFFF`, no purple blurry gradients, solid ink borders `#18181B`).

---

## 2. Feature Inventory & Test Tier Mapping

Every feature identified in `PROJECT.md` is mapped to at least one test tier across four distinct layers:

| Feature # | Feature Name | Test Tier | Primary Test File | Verification Scope |
|---|---|---|---|---|
| F1 | Supabase DDL for `model_templates` | Tier 1, 2 | `tier1_feature.test.js`, `tier2_boundary.test.js` | Schema shape, `model_key = [Model] + [Specs]`, unique constraint |
| F2 | Supabase DDL for `circular_posts_queue` | Tier 1, 3 | `tier1_feature.test.js`, `tier3_combination.test.js` | Queue states (`queued`, `processing`, `posted`), priority, foreign key |
| F3 | Local JSON Fallback Storage | Tier 1, 2 | `tier1_feature.test.js`, `tier2_boundary.test.js` | Fallback persistence when cloud DB is unavailable |
| F4 | Initial Model Templates Seeding | Tier 1 | `tier1_feature.test.js` | Default seed models (Dell Latitude, ThinkPad, HP Envy) |
| F5 | Express API: Template CRUD | Tier 1, 2 | `tier1_feature.test.js`, `tier2_boundary.test.js` | `GET, POST, PUT, DELETE /api/data-post/templates` |
| F6 | Express API: Smart Match Endpoint | Tier 1, 2, 3 | `tier1_feature.test.js`, `tier2_boundary.test.js`, `tier3_combination.test.js` | `POST /api/data-post/smart-match`, weighted scoring (threshold >= 60) |
| F7 | Express API: Circular Queue Endpoints | Tier 1, 3 | `tier1_feature.test.js`, `tier3_combination.test.js` | `GET, POST, DELETE /api/data-post/queue`, `POST .../trigger-post` |
| F8 | Desktop & Mobile Tab Registration | Tier 1 | `tier1_feature.test.js` | `#tabBtn-datapost`, `#mobileDockBtn-datapost`, `switchTab` integration |
| F9 | Neo-Brutalist Tab Layout & Filter Bar | Tier 1, 3 | `tier1_feature.test.js`, `tier3_combination.test.js` | Brand filter, price range filter, status filter, instant search |
| F10 | Model Card Component with HD Gallery | Tier 1 | `tier1_feature.test.js` | Card layout, specs display, mini gallery thumbnails (+N overlay) |
| F11 | Model Card Action Buttons | Tier 1 | `tier1_feature.test.js` | "⚡ Tạo bài mới từ mẫu", "🔄 Đưa vào hàng đợi", "🖼️ Quản lý kho ảnh" |
| F12 | Modals for Data Post | Tier 1 | `tier1_feature.test.js` | Template modal, Media manager modal, Circular settings modal |
| F13 | Slide 0 ("DESIGN BY VUONGGIA") Safety | Tier 1, 4 | `tier1_feature.test.js`, `tier4_realworld.test.js` | 100% pure monochrome, 5 marquee rows at -32deg, hotline/email, modal X |
| F14 | Responsive Mobile & Calm Performance | Tier 1, 4 | `tier1_feature.test.js`, `tier4_realworld.test.js` | Mobile dock buttons, zero heavy animations on mobile |
| F15 | AI Studio Smart Match Banner | Tier 1, 3 | `tier1_feature.test.js`, `tier3_combination.test.js` | `#smartMatchBanner` visibility, badge, 1-click button |
| F16 | 1-Click HD Album Injection | Tier 3 | `tier3_combination.test.js` | Media injection into `currentMediaFiles`, keeping machine code & price |
| F17 | AI Rewrite Engine (4 Rotating Hooks) | Tier 1, 3, 4 | `tier1_feature.test.js`, `tier3_combination.test.js`, `tier4_realworld.test.js` | `hook_office`, `hook_durability`, `hook_mobility`, `hook_budget` |
| F18 | Algorithmic Fallback Rewrite | Tier 2, 4 | `tier2_boundary.test.js`, `tier4_realworld.test.js` | Deterministic rewrite fallback when Gemini API is rate-limited/offline |
| F19 | Circular Queue Scheduler Integration | Tier 3, 4 | `tier3_combination.test.js`, `tier4_realworld.test.js` | Daily time slots (08:30, 11:45, 15:30, 20:00), execution trigger |
| F20 | E2E Testing Suite (Tiers 1-4) | All Tiers | `tests/e2e/test_runner.js` | Automated multi-tier execution with exit code semantics |
| F21 | Final Integration & Zero Blind Trust Acceptance | Tier 4 | `tier4_realworld.test.js` | Full lifecycle simulation with realistic Vietnamese shop owner workflow |

---

## 3. Test Architecture

### 3.1. Directory Structure
```
tests/e2e/
├── test_runner.js              # Central CLI runner & reporter (Exit code 0/1)
├── test_helpers.js             # Shared HTTP client, ephemeral server launcher, assertions, oracle
├── tier1_feature.test.js       # Tier 1: Isolated feature coverage (CRUD, filters, DOM, Slide 0)
├── tier2_boundary.test.js      # Tier 2: Boundaries, edge cases, validation errors, XSS/SQLi
├── tier3_combination.test.js   # Tier 3: Multi-step cross-feature integrations
└── tier4_realworld.test.js     # Tier 4: Real-world shop workflows & Slide 0 production audit
```

### 3.2. Execution Commands
- **Run all E2E test suites**:
  ```bash
  node tests/e2e/test_runner.js
  ```
- **Run specific tier**:
  ```bash
  node tests/e2e/test_runner.js tier1
  node tests/e2e/test_runner.js tier2
  node tests/e2e/test_runner.js tier3
  node tests/e2e/test_runner.js tier4
  ```
- **Run against external running instance**:
  ```bash
  TEST_BASE_URL=http://localhost:3000 node tests/e2e/test_runner.js
  ```

### 3.3. Pass / Fail Semantics
- Each test case is tracked individually with high-resolution duration timers (`performance.now()`).
- Output format:
  ```
  [PASS] [Tier 1] 1.1: Template CRUD - GET /api/data-post/templates (42ms)
  [PASS] [Tier 1] 1.2: Template CRUD - POST /api/data-post/templates generates model_key (28ms)
  ...
  =======================================================
  E2E Test Execution Summary:
    Total Tests : 52
    Passed      : 52
    Failed      : 0
    Duration    : 1420ms
  =======================================================
  Status: ALL TESTS PASSED (Exit Code: 0)
  ```
- Process exits with code `0` if 100% of tests pass.
- Process exits with code `1` if any test fails, printing detailed assertion diffs and stack traces.

---

## 4. Test Tiers Detail

### Tier 1: Isolated Feature Coverage
- **API CRUD**:
  - `GET /api/data-post/templates`: Returns 200, `{ success: true, count, data }`.
  - `POST /api/data-post/templates`: Validates `model_name`, `cpu`, `ram`. Auto-generates `model_key = [Model] + [Specs]`. Returns 201.
  - `PUT /api/data-post/templates/:id`: Modifies price, specs, photos. Returns 200.
  - `DELETE /api/data-post/templates/:id`: Deletes or sets status `inactive`. Returns 200.
- **Filtering & Search**:
  - Filter by `brand` (Dell, HP, ThinkPad, Lenovo).
  - Filter by `price_range` (`under_5m`, `5m_8m`, `8m_12m`, `above_12m`).
  - Filter by `status` (`active`, `inactive`).
  - Search query matching substring in `model_name` or `cpu`.
- **Smart Match Scoring**:
  - `POST /api/data-post/smart-match` with Zalo text.
  - Evaluates weighted score (Brand: 20, Model number: 35, Full model name: 45, Specs tokens: 15).
  - Returns `matched: true` when score >= 60, linking HD `media_files`.
- **Circular Queue Endpoints**:
  - `GET /api/data-post/queue`: Returns queued items.
  - `POST /api/data-post/queue`: Adds template to circular queue with scheduled slot.
  - `POST /api/data-post/queue/trigger-post`: Simulates publishing, increments template `post_count`, sets `last_posted_at`.
- **UI & DOM Structure**:
  - Desktop nav tab `#tabBtn-datapost`, mobile dock `#mobileDockBtn-datapost`.
  - Section `#section-datapost` with Neo-Brutalist filter bar and model cards.
  - Slide 0 container preservation check.

### Tier 2: Boundary & Corner Cases
- **Validation Errors**:
  - Empty body on template creation -> HTTP 400 Bad Request.
  - Missing required `model_name` -> HTTP 400 with descriptive error.
  - Missing CPU or RAM specs -> HTTP 400 with validation details.
- **Price Boundaries**:
  - `price_min > price_max` -> HTTP 400.
  - Negative price values (`price_min: -500000`) -> HTTP 400.
  - Non-numeric price values -> HTTP 400.
- **Resource Not Found**:
  - `GET /api/data-post/templates/non-existent-id` -> HTTP 404.
  - `PUT /api/data-post/templates/non-existent-id` -> HTTP 404.
  - `DELETE /api/data-post/templates/non-existent-id` -> HTTP 404.
- **Malformed & Extreme Text**:
  - Smart Match with empty string -> `matched: false`, `score: 0`.
  - Smart Match with completely unrelated text (e.g. food recipe) -> `matched: false`.
  - Extreme text payload (10,000+ characters) -> Handled cleanly without timeout/crash.
- **Security & Injection Integrity**:
  - SQL injection payload in model_name (`'; DROP TABLE model_templates;--`) -> Stored and handled safely as literal text.
  - XSS payload in model_name (`<script>alert('xss')</script>`) -> Sanitized/escaped safely.
- **Queue Corner Cases**:
  - Enqueueing invalid/non-existent template ID -> HTTP 400/404.
  - Duplicate model key insertion -> Handled gracefully with idempotent update or 409 conflict.

### Tier 3: Cross-Feature Combinations
- **Full Ingestion & Media Reuse Flow**:
  1. Paste raw Zalo text containing "Dell Latitude 5350".
  2. Smart Match identifies matching template, returning score >= 60 and 6+ HD photos.
  3. Simulate 1-click album injection: extract media files, attach new machine code (`#999`) and new price (`14.5 tr`).
  4. Enqueue template to circular queue.
  5. Trigger post execution.
  6. Verify template `post_count` incremented by 1 and `last_posted_at` updated.
- **Template Lifecycle**:
  Create -> Read list -> Update specs -> Search by new specs -> Smart match matches updated specs -> Delete -> Verify removal from active listing.
- **Combined Brand & Price Filters**:
  Verify multi-parameter queries (`brand=Dell&price_range=8m_12m`) return strictly the intersection of both criteria.
- **AI Rewrite Multi-Hook Rotation**:
  Trigger posts across all 4 rotating hooks (`hook_office`, `hook_durability`, `hook_mobility`, `hook_budget`), verifying distinct angles and removal of temporary codes (`#101`, `#046`).

### Tier 4: Real-World Scenarios & Production Verification
- **Multi-Model Japanese Fleet Simulation**:
  A shop owner manages multiple core models:
  - Dell Latitude 5350 (Ultra 5 / 16GB / 256GB SSD)
  - ThinkPad T480s (Core i5-8350U / 8GB / 256GB SSD)
  - HP Envy x360 15 (Ryzen 5 4500U / 8GB / 256GB SSD)
  The test verifies simultaneous management, individual post counts, and independent circular queues.
- **Daily 4-Slot Circular Replenishment**:
  Simulates a day with empty Zalo arrivals. 4 circular posts are scheduled across daily slots (08:30, 11:45, 15:30, 20:00). Verifies text deduplication (Jaccard similarity < 55%) to protect against Facebook spam penalties.
- **Slide 0 ("DESIGN BY VUONGGIA") Absolute Compliance Audit**:
  - Verifies Slide 0 Pure Monochrome OLED black background (`#000000`) and pure white text (`#FFFFFF`).
  - Verifies 5 marquee lines titled `DESIGN BY VUONGGIA` tilted at `-32deg`.
  - Verifies central copyright certificate: `THUỘC QUYỀN SỞ HỮU CỦA VUONGGIA`, strict non-commercial clause, contact email `nguyennhu19022008@gmail.com`, hotline `0876637806`.
  - Verifies dismissal button `X` and navigation buttons.
  - Verifies that Tab DATA POST operations in `#mainApp` never leak into or alter Slide 0 DOM/state.

---

## 5. Coverage Thresholds

| Metric | Target | Minimum Acceptable |
|---|---|---|
| Total Automated Tests | >= 50 test cases | 50 test cases |
| Pass Rate | 100% | 100% |
| API Endpoints Covered | 100% of `/api/data-post/*` | 100% |
| HTTP Status Codes Covered | 200, 201, 400, 404 | 200, 201, 400, 404 |
| Boundary Cases Tested | >= 15 test cases | 12 test cases |
| Combinatorial Flows Tested | >= 5 flows | 4 flows |
| Slide 0 Audit Assertions | 100% compliant | 100% compliant |
| Execution Duration | < 5000ms | < 15000ms |
