# Ticket 11 / SCRUM-142 — Grading bug battery (Gate A feed)

**Who does what**

| Role | Work |
|---|---|
| Agent | Fixtures + this runbook; fix **blockers** you report |
| You (~90%) | Manual smoke on local/dev app; check pass/fail; sign off for Gate A ([SCRUM-138](https://damonjnunez.atlassian.net/browse/SCRUM-138)) |

Do not treat unit tests as a substitute for this suite.

---

## Setup (once)

1. App running (`npm run dev`), logged in as the pilot teacher.
2. Periods + roster ready. For case **D**, add two students who share a first name (e.g. `Alex Rivera` and `Alex Kim`) in the same period.
3. Create a daily-work assignment (Module/Unit/Lesson set) — e.g. `M1U1L3-HW`.
4. Keep this folder open: `test-fixtures/ticket10/` + `test-fixtures/ticket11/`.

### Fixture map

| File | Use for |
|---|---|
| `ticket10/01-answer-key.docx` | Good answer key |
| `ticket10/Damon Nunez.docx` | Typed on-topic (name must match a roster student — rename file or add Damon to roster) |
| `ticket10/Maria Lopez.docx` | Typed on-topic (same: match roster) |
| `ticket11/Jordan Lee-off-topic.docx` | Typed off-topic |
| `ticket10/IMG_1001.jpg` + `IMG_1002.jpg` | Photo + multi-page combine |
| `ticket10/scan-homework.pdf` | Image-only / scan PDF (vision path) |
| `ticket11/99-wrong-format-key.txt` | Reject bad answer-key format |

Rename student files or roster names so filename/header matching works for your roster.

---

## Cases — check pass / fail / notes

### A — Typed .docx on-topic

- [ ] Upload `01-answer-key.docx` (auto-saves; extracted text looks right).
- [ ] Upload `Damon Nunez.docx` and/or `Maria Lopez.docx`.
- [ ] File into period folder → grade → class summary shows range + comment.
- [ ] Copy comment works; Mark final works.

**Pass if:** clean match, graded result, summary row usable.  
**Fail notes:**

### B — Typed .docx off-topic

- [ ] Same answer key as A.
- [ ] Upload `Jordan Lee-off-topic.docx` (roster must include Jordan Lee, or rename file).
- [ ] Grade runs; AI does not invent that the student answered the key well.

**Pass if:** low / honest grade or clear “off topic / unanswered” style feedback — not a free A.  
**Fail notes:**

### C — Photo homework + multi-page combine

- [ ] Drop `IMG_1001.jpg` and `IMG_1002.jpg` together.
- [ ] **Combine** section appears **above** Ready/File; combine before filing.
- [ ] Combined paper files as one student paper.
- [ ] Vision / masked preview path if needed → approve → grade.

**Pass if:** combine-first is obvious; one paper after combine; grade completes or clear awaiting-approval.  
**Fail notes:**

### D — Shared first name → `[student]` / `[[STU_SHARED]]`

- [ ] Roster has two students with the same first name.
- [ ] Upload work for one of them (filename/header with that first name).
- [ ] Grade. Accommodation / privacy: no raw shared-first-name leak in the teacher-facing AI comment if the model echoes tokens; grading still completes.

**Pass if:** paper files or lands in Unsorted with a clear reason if ambiguous; grade does not blow up; shared-name sanitizer behavior holds (unit-tested already — this is E2E smoke).  
**Fail notes:**

### E — Wrong format / replace answer key

- [ ] Try upload `99-wrong-format-key.txt` as answer key → rejected with a clear error.
- [ ] Replace with `01-answer-key.docx` → auto-saves.
- [ ] Edit extracted text if garbled → **Save text edits**.
- [ ] **Clear answer key** works; can set “No answer key” / re-upload.

**Pass if:** reject → replace → clear all work without stuck state.  
**Fail notes:**

### E2 — Multi-page **photo** answer key (CamScanner)

- [ ] Drop **all** `CamScanner …_N.jpg` pages together (progress should say Received N files).
- [ ] AI vision structures the key into `1. A` / short-answer / Visual lines.
- [ ] Edit anything unclear → **Save text edits**.
- [ ] Student photos still use masked vision + approve step; grades use the structured key text.

**Pass if:** all pages ingested (filename like `N pages (…)`); structured key looks usable.  
**Fail notes:**

### F — Image-only scan PDF

- [ ] Upload `scan-homework.pdf` against the key.
- [ ] Expect vision / awaiting approval (or needs-vision guidance), not a silent empty grade.
- [ ] Masked preview → Approve & grade **or** Don’t send to AI.

**Pass if:** empty OCR doesn’t fake a text grade; approval / manual path is clear.  
**Fail notes:**

### G — Empty OCR / awaiting approval / don’t send to AI

- [ ] On a photo or scan stuck in awaiting approval: open period folder card.
- [ ] Confirm masked preview copy is readable.
- [ ] **Don’t send to AI** → status becomes manual / not sent; no AI call.
- [ ] Class summary shows a readable status (not a blank hole).

**Pass if:** decline path sticks; summary shows Missing/manual/not-sent clearly.  
**Fail notes:**

### H — Essay path + unit rubric *(optional / deferred)*

- [ ] Skip unless essay rubric + sample exist (roadmap Phase 0 deferred; ties to SCRUM-24/25).
- [ ] When available: new essay assignment + unit rubric + exemplar + one essay upload → grade.

**Pass if:** essay assignment grades with unit rubric (not daily-only).  
**Status:** ☐ skipped  ☐ pass  ☐ fail — notes:

---

## Ticket 11 polish smoke (quick)

While you’re in the app, also glance at:

- [ ] Class summary above cards; Missing students in red.
- [ ] Copy + Mark final + Finalize all (confirm Finalize all uses saved grades, not unsaved edits in other rows).
- [ ] Assignment page order: answer key → homework → combine → file.

---

## Sign-off

| | |
|---|---|
| Date | |
| Tester | |
| Blockers filed | (Jira keys / chat notes) |
| Gate A ready? | ☐ yes  ☐ no — why: |

Results feed **Gate A** on [SCRUM-138](https://damonjnunez.atlassian.net/browse/SCRUM-138).
