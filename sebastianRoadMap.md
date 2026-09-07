# Project Sebastian — MVP Roadmap

## Product direction (keep in mind)

- **Universal tool**: Built for many teachers, subjects, districts — not hard-coded for one person.
- **First validation user**: Your mom (middle school English/Social Studies) is the first real-world test case, not the only supported case.
- **Lesson planning (data-driven)**: Teacher uploads the district's base lesson plan. The app pre-fills the repetitive "formula" sections that are always copied from district docs, then the teacher adds class-specific inputs (groups, free-text asks, etc.) before final generation.
- **Phase 0 samples** (rubrics, frameworks, graded work) are **calibration/test data**, not the app's source of truth.

---

## Scope ↔ Roadmap alignment

| In scope doc | In roadmap? | Notes |
|---|---|---|
| Multi-section rosters + student notes | Partial | Schema in Ticket 1; **setup UI not its own ticket yet** |
| Rubric & unit setup (HW, short-response, essay-by-unit) | Yes | Ticket 5 |
| Per-section rubric override | **Missing** | Foundational in scope — needs explicit ticket or Ticket 5 subtask |
| Lesson: framework upload, groups, free-text, iterate | Partial | Ticket 4 — add follow-up prompts + fast review |
| Lesson: link preservation (YouTube, etc.) | **Missing** | V1 in scope |
| Lesson: save to Google Drive | Yes | Ticket 2 + Ticket 4 |
| Grading: doc upload, auto-match, grade range, edit | Yes | Tickets 6–7 |
| Grading: accommodation flag visible in suggestion | **Missing** | V1 in scope — part of Ticket 7 |
| Grading: per-student copy + class summary export | Yes | Ticket 8 |
| Sanitizer (local, before any AI call) | Yes | Ticket 3 — shared by lesson + grading |
| Data privacy / FERPA approach | **Implicit only** | Should be acceptance criteria on Tickets 3, 6, 7 |
| Teacher accounts / multi-tenant isolation | Deferred | MVP = **one login, one teacher**; multi-tenant later |
| Auth (login) | Yes | Ticket 1 — simple single-user auth (Google OAuth candidate for Drive) |
| Hosting / deployment | **Resolved** | Vercel + Supabase |

---

## Phase 0: Discovery & Calibration (before code)

**Goal**: Real formats and standards so we build against data, not guesses.

- [x] Collect district framework docs (multiple lessons; multiple formats if possible)
- [x] Collect example **filled-in** lesson plans (1 Work Time block + multiple Work Time blocks)
- [x] **HAVE** HW/classwork rubric (4-point, pasted in Mariposas L1–L3; does not change)
- [ ] **DEFERRED (Phase 1B)** essay rubric — not needed to start lesson planning
- [ ] **DEFERRED (Phase 1B)** 3–5 teacher-graded essays/short answers
- [ ] **DEFERRED (Phase 3)** report card comment code list
- [x] Confirm privacy approach: real student data stays local; sanitizer/anonymizer before every external AI call
- [x] Decide: V1 upload = `.docx` + `.pdf` (Google Docs via export to those). Export as flexible as possible (Drive save + downloadable `.docx`/`.pdf`)

**Exit criteria (lesson-planning path):** Met. Frameworks + filled-in plans + HW/CW rubric + format/privacy decisions are enough to start Tickets 0–7. Grading calibration is **not** a Phase 1A blocker.

### Phase 0 inventory (2026-09-01)

Three source families — parser must handle all three, not just the preferred one:

| Family | Location | Lessons on disk | Format | Role |
|---|---|---|---|---|
| Simpler district skeleton | `lessonPlanReferencesMother/[FY 25] D13- EL Lesson Unpacking Task Card (1).pdf` | blank template | PDF | Preferred planning skeleton (Opening / Work Time A–C / Closing) |
| Teacher filled-in plans | `lessonPlanReferencesMother/` | Mariposas **1, 2, 3, 7, 10**; Omnivore’s M2U2 **L7** | PDF | How she actually writes plans; formula vs liberties |
| EL module lessons (Mariposas) | `lesssonPlanReferencesSchool/ELA_G8M1U1L{1,2,3,7}/` | **1, 2, 3, 7** | `.docx` | Official EL “formula” source for Module 1 |
| Kiddom export (verbose) | `lesssonPlanReferencesSchool/U1L{1,2,3,7}-Kiddom.pdf` | **1, 2, 3, 7** | PDF | Same EL curriculum, heavier Kiddom layout — **Omnivore’s / Food Choices**, not Mariposas |

**Numbering note**: Disk has **1, 2, 3, 7** (plus mother Lesson 10). There is **no Lesson 5** in the repo. Kiddom U1L* is a different module than the Mariposas filled-in plans — useful for “universal parser,” not a same-lesson A/B compare.

**Work Time variation (filled-in plans)**: L1 = A–D (4 blocks); L2, L3, L7, L10, Omnivore’s L7 = 2 blocks. Meets “one vs multiple Work Time” without Lesson 5.

**Copied vs custom (first pass)**: Header, standards, agenda, materials, and “Repeated routine” steps come from the framework. Liberties show up as named teachers/ICT model, collapsed timing, Think-Pair-Share scripts, differentiation (triangle note-catcher, triads, sticky-note hints), gist notes, and (on L1–L3) the pasted 4-point HW/classwork rubric.

**Deferred until grading (Phase 1B), not blocking lesson planning:**
- Essay rubric (by type). Lesson mentions Informative Writing Checklist; the actual table is not in the repo.
- 3–5 already-graded student samples.

**Deferred until Phase 3:** report card comment codes.

**HW / classwork rubric — HAVE IT.** 4 Exceeds / 3 Meets / 2 Approaching / 1 Does not meet. Same paste in Mariposas L1–L3. Enough for later HW grading; not a substitute for the essay rubric.

---

## Phase 1 — Foundation (before feature modules)

Shared infrastructure every teacher and every AI feature depends on.

### Ticket 0: Project boilerplate + deployment skeleton
- **Stack (locked)**:
  - **Frontend/API**: Next.js on **Vercel**
  - **Database**: **Supabase** (Postgres)
  - **AI**: **Claude Sonnet** via Anthropic API
  - **AI access pattern**: Option B — `getAiClient(teacherId)` abstraction; app API key in Vercel env for MVP
- Desktop-first web UI
- Supabase project + env vars wired for local dev and Vercel deploy
- Stub `teachers` table: nullable `api_key_encrypted`, optional `usage_tokens` (unused in MVP, ready for teacher-paid future)

### Ticket 1: Auth (single teacher, MVP)
- Simple login for one teacher account (Google OAuth is a strong candidate — also unlocks Drive)
- No multi-tenant / school org workspaces in MVP — design schema so isolation can be added later without a rewrite
- **Decided**: one login only for now

### Ticket 2: Core database schema
- Sections / periods, rosters, student notes (accommodations)
- Units, rubrics (HW, short-response, essay-by-type), per-section rubric overrides
- Lesson templates/config (data-driven structure — not hard-coded blocks)
- Lesson plans, grading sessions, generated suggestions (draft vs. final)

### Ticket 3: Local deterministic sanitizer (build + test early)
- Roster-driven name redaction before **any** external AI call
- Local rehydration on display
- Local document → student matching (filename / header text; no AI for identity)
- Unit tests with realistic names and edge cases (nicknames, duplicates?)

---

## Phase 1A: Setup + Lesson Planning (ship first)

**Goal**: Usable lesson-planning tool on its own before grading ships.

### Ticket 4: Teacher setup — rosters & sections
- Create sections/periods
- Add students + optional notes per student
- Matches scope "Setup phase — Roster setup"

### Ticket 5: District framework parsing (data-driven pre-fill)
- Teacher uploads the school's base lesson plan (district framework doc)
- App identifies and pre-fills the repetitive sections that are always copied from district docs (the "formula" parts)
- Teacher reviews/edits pre-filled content, then adds class-specific inputs (groups, free-text asks, block count, etc.) before final AI generation
- Flexible Work Time block count per lesson
- **Decided**: not a hard-coded app skeleton — driven by uploaded district doc + teacher modifications

### Ticket 6: Google Drive integration
- OAuth (may overlap with Ticket 1)
- Save finished plan to Drive (fixed folder OK for V1; folder picker = fast-follow per scope)

### Ticket 7: Lesson Planning Assistant (core flow)
- Upload district framework doc → parse & pre-fill repetitive formula sections
- Teacher modifies pre-filled content + adds class-specific inputs
- Per-lesson groups (A/B/C, pairs) — temporary, not stored as permanent student tiers
- Structured fields (date, section, block count) + free-text asks
- AI draft → **follow-up prompt iteration** (don't force restart)
- **Fast, light review** (approve-and-move-on; not a heavy editor)
- **Preserve links** in draft + editor (YouTube, resources)
- All prompts route through sanitizer

**Phase 1A exit criteria**: Teacher can set up classes, upload a framework doc, generate + iterate a plan, save to Drive — for a lesson format they didn't hard-code into the repo.

---

## Phase 1B: Grading Assistant

**Goal**: Rubric-grounded grade ranges + feedback; copy/export for Jupiter manual entry.

### Ticket 8: Rubric & unit setup UI
- General HW rubric + adjustable category weights
- General short-response rubric
- Units + essay-type rubrics (unit-exclusive essays)
- Per-section rubric override ("edit rubric for this section")
- Matches scope "Setup phase — Rubric & unit setup"

### Ticket 9: Document upload + local student/class matcher
- Upload only (no copy/paste per scope)
- Auto-match student + section from roster locally
- **Fallback (decided)**: manual selection via class dropdown + student name when auto-match fails or is ambiguous

### Ticket 10: AI grading — range + feedback
- **Teacher selects assignment type via dropdown** (HW / short-response / unit essay) — drives logging + which rubric applies
- Suggested **grade range** (4–5 pt spread) + rubric-grounded comments
- Calibrated against Phase 0 samples (content vs. mechanics)
- **Visible flag** when student accommodation notes were considered — teacher decides final interpretation
- Sanitized payloads only

### Ticket 11: Review, export & class summary
- Edit grade + comments before marking final in app
- Per-student: copy comment + clear grade display
- Per-class table: all students, grades, comments — work through a section in one sitting
- No Jupiter auto-submit (explicitly out of scope V1)

**Phase 1B exit criteria**: Teacher can grade a batch of work with ranges, accommodation visibility, and efficient copy-out to Jupiter.

---

## Phase 2 — Refinement (post-MVP)

- Class-summary workflow polish from real usage
- Saved rubric library / reuse across assignments
- Lesson plan history, "continue from last lesson"
- Google Drive folder picker
- Grade-range workflow for online HW (e.g. Kiddom) when relevant
- AI-usage soft-flag only (uncertain signal, not a verdict — per scope caution)
- **Loading UI for “anonymizing”** — when Grade / Generate kicks off, show a short loading state (e.g. progress/status “Anonymizing…”) while the sanitizer runs before the AI call (stretch; not required for Ticket 3 core)

---

## Phase 3 — Stretch / automation

- Jupiter Chrome extension (pre-fill grade + comment; teacher submits)
- Report card comment code suggester
- Both flagged as fragile (depends on school site DOM)

---

## MVP gaps — status

| Gap | Status |
|---|---|
| Multi-teacher auth & data isolation | **Deferred** — MVP is one login |
| Setup/onboarding tickets | **Resolved** — Tickets 4 and 8 |
| Per-section rubric override | **In scope** — Ticket 8 |
| Lesson link preservation | **In scope** — Ticket 7 |
| Accommodation visibility in grading UI | **In scope** — Ticket 10 |
| Ambiguous student-match fallback | **Resolved** — manual class + student picker |
| Assignment type / rubric selection | **Resolved** — teacher dropdown per upload/batch |
| Supported file types for upload | **Resolved** — V1 `.docx` + `.pdf` |
| AI provider + hosting | **Resolved** — Option B + Sonnet + Supabase (see Architecture stack) |

---

## Decisions locked in

| # | Topic | Decision |
|---|---|---|
| 1 | Accounts | **One login, one teacher** for MVP |
| 2 | Lesson flow | Upload district base plan → app pre-fills repetitive formula sections → teacher modifies + adds class-specific inputs → generate |
| 3 | Failed student match | **Manual fallback**: class dropdown + student name |
| 4 | Rubric / assignment type | **Teacher dropdown** (HW / short-response / essay) — drives logging + rubric |
| 5 | AI provider + hosting | **Option B** — Vercel + Supabase + Claude Sonnet; you pay MVP, teacher pays later |
| 6 | Timeline / scope cuts | **No cuts** — full MVP scope; first month of lesson plans already done |
| 7 | V1 file types | **Upload `.docx` + `.pdf`**. Google Doc = export to those first. Export: Drive + downloadable `.docx`/`.pdf` |
| 8 | Privacy / Phase 0 samples | Real student PII stays local. Sanitizer runs before every AI call. Samples are calibration, not the only supported layout |
| 9 | Framework flavors | Support both verbose Kiddom/EL exports **and** the simpler unpacking / filled-in skeleton |
| 10 | Phase 0 remaining samples | **Deferred**: essay rubric + graded work wait for Phase 1B; report card codes wait for Phase 3. Lesson planning is the priority. |

---

## Open questions (remaining)

- **Grade scale** *(Phase 1B)*: Embedded HW rubric is **1–4**, while Jupiter grading in scope is **0–100 ranges**.
- **Short-response rubric** *(Phase 1B)*: Same 4-point HW/classwork rubric, or a separate one?
- **Essay rubrics** *(Phase 1B)*: Need the actual table, not just a lesson reference.
- **Sanitizer edge cases**: **Locked (Ticket 3 V1)** — full roster name always; first/last only if unique on roster; no nickname dictionary; duplicate full names → lowest student id wins; doc match from filename/header is local (`matched` / `none` / `ambiguous`).
- **Batch lesson prep**: One-at-a-time OK for MVP if each lesson is fast?

---

## Architecture stack (locked — Gate 3 ✅)

| Layer | Choice | MVP behavior | Future path |
|---|---|---|---|
| **Hosting** | Vercel | Deployed web app your mom accesses in browser | Same; add preview envs per branch |
| **Database** | Supabase (Postgres) | All rosters, rubrics, plans, grades | Row-level isolation when multi-teacher |
| **AI model** | Claude Sonnet (Anthropic) | Lesson drafts + grading suggestions | Tune to Haiku for cheap drafts if cost grows |
| **AI billing** | Option B abstraction | Your API key in `ANTHROPIC_API_KEY` env var | Teacher BYOK via `api_key_encrypted` or subscription |
| **Auth** | Google OAuth (planned Ticket 1) | One teacher login | Extend for more teachers |
| **Privacy** | Local sanitizer (Ticket 3) | Redact student names before every API call | Unchanged |

### How Option B works (high level)
1. Lesson/grading code calls `getAiClient(teacherId)` — never imports the SDK directly in feature code.
2. MVP: function reads app key from env, returns configured Sonnet client.
3. Future: if teacher has `api_key_encrypted` set, use theirs; else app key + track `usage_tokens`.
4. Sanitizer runs **before** the prompt hits `getAiClient` — always.

### Env vars (Ticket 0 checklist)
- `ANTHROPIC_API_KEY` — your key for MVP
- `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` (or anon + RLS later)
- Google OAuth client ID/secret (Ticket 1 / Ticket 6)

### Explicitly deferred (not MVP)
- Multi-provider failover (Claude + OpenAI)
- Usage billing / Stripe
- District formula caching
- Per-model routing (Sonnet vs Haiku split)

---

## Suggested build order (summary)

```text
Phase 0  →  samples + format decisions
Ticket 0 →  boilerplate (Vercel + Supabase + Sonnet abstraction)
Ticket 1 →  auth (single teacher, Google OAuth)
Ticket 2 →  schema
Ticket 3 →  sanitizer (test early)
Ticket 4 →  roster/section setup
Ticket 5 →  district framework parse + pre-fill
Ticket 6 →  Google Drive
Ticket 7 →  lesson planning flow  ──► SHIP 1A
Ticket 8 →  rubric/unit setup
Ticket 9 →  doc upload + matcher
Ticket 10 → grading AI
Ticket 11 → export + class summary  ──► SHIP MVP
```
