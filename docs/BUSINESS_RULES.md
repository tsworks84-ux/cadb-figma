# Business rules

The rules CADB enforces, why they are what they are, and where they live in the code. Most of these
were explicit decisions by the academy. **Do not "simplify" one without checking with the product
owner** — several look odd in isolation but are deliberate.

Code references are relative to `apps/api/src/` unless stated.

---

## 1. Leave

### 1.1 Calendar and fiscal year
- The working week is **Monday–Saturday**. Sunday is the weekly off.
- The leave year is the **fiscal year, 1 April – 31 March** (`getFiscalYear` in `utils/leave.ts`). A leave
  belongs to the fiscal year of its start date.

### 1.2 Entitlement and accrual
- Leave types: `CASUAL`, `SICK`, `EARNED`, `MATERNITY`, `PATERNITY`, `COMPENSATORY` (comp-off), `UNPAID`,
  `SPECIAL`.
- Each employee's **leave policy** comes from their designation's **grade** (`LeavePolicy` →
  `LeavePolicyGrade`), with a `LeavePolicyRule` per leave type giving days per year. The first time a
  year's balances are read, they are provisioned from the policy (`LeaveBalance` rows per type).
- Leave **accrues monthly**: 1/12 of the annual allocation per elapsed month of the fiscal year
  (`computeAccrued`). Accrual is counted up to *today*, so the balance grows through the year.
- **Joining mid-year is pro-rated:** joined on day 1–15 → the joining month counts in full; day 16–31 →
  it counts as half. Earlier months count nothing.
- **Carry-forward** is a per-policy toggle (`LeavePolicy.carryForward`). On: last year's unused days roll
  into `LeaveBalance.carried`, capped by the rule's `maxCarryForward` (0 = no cap). Off (default): the
  balance resets on 1 April.

### 1.3 Balance
```
available = accrued + carried + earned(comp-off) − used(approved) − pending(applied, undecided)
```
Figures are rounded to two decimals (`roundDays`) — accrual produces tenths, leave is taken in halves,
and floating point otherwise prints 1.7999999999999998. Negative balances are shown as 0.

### 1.4 Counting days — sandwich policy
- **Every calendar day between the first and last day is charged**, including a Sunday or holiday in the
  middle: Friday → Monday is **4 days** (`countLeaveDays`). Sundays at either *end* are trimmed; a range
  of only Sundays is rejected.
- Half days (first/second half) are 0.5 and must be a single date.
- The web form previews the count; the server always recomputes it.

### 1.5 Applying
- An employee may apply for **more than their balance** for every type **except comp-off**; the approver
  decides. Comp-off can never be overdrawn, because those days exist only if an approved comp-off minted them.
- Applying moves the days into `pending`; a decision moves them out.

### 1.6 Loss of Pay (LoP)
- **`LeaveApplication.lopDays` is the single source of truth for loss of pay**, for every leave type.
  Payroll, the balance screens and reports read only this field.
- **On approval, LoP defaults to the shortfall:** the days the balance cannot cover (`assessLeaveLop` in
  `routes/v1/leaves.ts`). Example: 8 days available, 11 applied → 3 days LoP. Unpaid leave is LoP in full.
  Other pending requests are not held against the one being decided; whichever is approved first draws
  the balance down.
- An approver may book **more** LoP than the shortfall. Booking **less** is a **waiver**, allowed only for
  the employee's **immediate supervisor, HR Admin or Super Admin** (`canWaiveLop`). Anyone else gets a 403.
  The approval screens pre-fill the shortfall and lock the minimum for non-waivers
  (`GET /leaves/:id/lop-assessment`).
- **Partial LoP is counted back from the last day of the leave.** 29 Jan – 2 Feb with 3 LoP days →
  2 Feb, 1 Feb, 31 Jan (February 2 days, January 1). Half days supported (`lopDaysInMonth`).
- **Payroll deduction** (salary disbursement report, `routes/v1/reports.ts`): one day's pay =
  **basic ÷ calendar days in that month** (1/31 in January, 1/28 or 1/29 in February) — never a
  working-day count. Each month's share of a leave is charged against that month's salary.
- **Not retrospective.** The sandwich rule (v1.9.0) and automatic shortfall LoP (v1.25.0) apply to leaves
  decided after they shipped. Older records keep the values they were approved with; there was no backfill,
  by explicit decision.

### 1.7 Statuses and cancellation
`PENDING → APPROVED / REJECTED`; withdrawing a pending leave cancels it outright; withdrawing an approved
leave moves it to **`CANCELLATION_PENDING`** until the approver signs off.

**A leave in `CANCELLATION_PENDING` is still in force** — days stay used, the person counts as away, LoP
still applies. Always filter with `IN_FORCE_LEAVE_STATUSES` (`utils/leave.ts`), never `status: "APPROVED"`
alone, or payroll silently drops those leaves.

Super Admin / HR can **force-cancel** or **permanently delete**; both are written to the audit log
(Deletion Log page) with a full snapshot.

### 1.8 Comp-off
Working on a weekly off earns a day back: `CompOffRequest` (work date, 0.5 or 1 day) → approved by the
same people who approve leave → credited to `LeaveBalance.earned` for the **COMPENSATORY** type in the
fiscal year of the work date (added whole, not accrued). Any work date may be claimed (the approver sees a
warning if it was an ordinary working day); credits never expire; self-approval is blocked.

### 1.9 Who approves
See [ACCESS_CONTROL.md §3](ACCESS_CONTROL.md#3-reporting-line-authority): supervisor or department head,
HR / Super Admin, and roles holding the leave approval grants. Approvers see the applicant's balances
while deciding.

---

## 2. Employees
- **Employee code:** `YYMM` + 3-digit global serial (e.g. `2603001`); login uses this code, not email.
- **Probation:** new joiners auto-confirm to ACTIVE after **3 months** (daily job, `utils/probation.ts`).
- An employee can belong to **several departments**; one is primary (`Employee.departmentId`).
- **On staff vs archived** (`utils/staffStatus.ts`, mirrored in web `lib/staff.ts`): ACTIVE, PROBATION, ON_LEAVE and
  NOTICE_PERIOD are on staff; TERMINATED, RESIGNED, RETIRED and EXITED are archived. The Employees list shows
  on-staff people plus unfinished DRAFTs; **Archive** shows the rest. The headcount card matches the list.
- **Staff dropdowns** offer only on-staff people (`/employees/lookup` default; `?status=all` for screens that keep a
  saved choice visible after the person has left). Where a subject is chosen (class, assignment, exam paper), only
  that subject's faculty are offered: people who teach it in any batch (`BatchSubject`), plus its head for exam
  pickers. If nobody is mapped to the subject yet, all on-staff people are offered instead of an empty list.

---

## 3. Claims (reimbursements)
- Lifecycle: **DRAFT → SUBMITTED → APPROVED / REJECTED → PAID**, with withdrawal via
  `CANCELLATION_PENDING` → `CANCELLED`. A draft is private; notifications fire on submit, not create.
- **Expense date** (the day the money was spent) is required on new claims and cannot be in the future
  (IST). It is separate from the filed date.
- **Reviewing and paying:** Super Admin, HR Admin, or a role holding `EMP_ALL_CLAIMS` approve. A note is
  required to **reject**, optional to approve. **Cancellation requests** are decided by SA/HR only.
- Claim types and their limits are configured in Administration → Claim Types.

---

## 4. Notifications
Approval requests notify the applicant's supervisor, every HR Admin and every Super Admin; decisions notify
the applicant. A manager can mute team leave/claim **emails** in Settings (the bell still shows them).
Super Admin can switch any event × channel off (Administration → Notifications); a missing setting row
means *on*. Delivery is asynchronous with retries (ARCHITECTURE §7).

---

## 5. Students and fees
- A student can be in **several batches** (`StudentBatch`), with history kept.
- **Fee maths, used everywhere** (student page, Revenue, Academics overview):
  ```
  netPaid    = paidFee − refundAmount
  balanceDue = (totalFee − discount) − netPaid
  ```
  A **refund** (cancelled admission) puts money back onto the balance due; it is never a discount.
  Refunds cannot exceed what is net-paid, and a payment that refunds already cover cannot be deleted.
  `Student.paidFee` / `refundAmount` mirror the sums of their logs.
- **Bulk import** of students uses a downloadable Excel template with a dry-run validation step
  (`utils/studentImport.ts`).

---

## 6. Academics

### 6.1 Schedule
Recurring classes are created as a **set of real `Schedule` rows** (one per occurrence, tied by
`recurrenceId`) because attendance and status are per class. Per-weekday times are supported; the server
computes the preview. Deleting can target one class or the series.

### 6.2 Assessments (exams)
- An exam has **papers × subject slots** (`ExamSubject`), batches, date/time, total marks. Presets exist for
  JEE Main, NEET and K-CET, and any exam can be saved as a reusable template.
- **Status names are confusing — read carefully.** `DUE` = not yet held / not marked; **`COMPLETED` = held,
  waiting for marks** (shown as "Due for Marking"); **`MARKED` = marks entered** (shown as "Completed");
  plus `CANCELLED`, `ARCHIVED`.
- The list is server-paged (200 per page) and searched on the server; counts on the stat cards come from the
  server over all tests, not the loaded page.
- **Marks entry:** students are listed alphabetically (sorted in JavaScript, not SQL, to interleave
  ALL-CAPS and Title Case names). Absent students' mark cells are disabled.
- **Marks import** (`utils/marksImport.ts`): download the exam's template → fill → upload. The upload is
  validated first (dry run) and anchors every error to the spreadsheet row. Only students in the file are
  touched. **A blank Present cell keeps the attendance already saved** (present if none was saved); a
  student marked absent on screen who has marks in the file is reported as an error, not silently flipped.
  Import Marks saves unsaved grid edits first.

### 6.4 Exam operations (tracking)
- Optional layer on an assessment: exam type (per academic year, set by Super Admin or a Controller), mode, Controller of
  Examinations, Examination Executive, and per-subject setter / reviewer / evaluator (`ExamSubjectTeam`, keyed by
  paper × subject slot). Rules live in `utils/examTracking.ts`.
- **Setter ≠ reviewer** for the same paper: blocked in the setup form, on save, and when reassigning either stage.
  Setter, reviewer and evaluator pickers list only that subject's faculty.
- **Mode:** Pen & paper, Online (Learnyst), or **Hybrid** (both: a printed paper and a Learnyst test). A stage
  template tagged with a mode applies only to that mode; Hybrid gets the printing *and* Learnyst stages.
- Setting up an exam snapshots the type's stage templates (16 by default) into `ExamStage` rows. Planned date =
  exam date + offset, moved back to the previous working day if it lands on a Sunday/holiday; exam day never moves.
  Overdue is derived on read. A stage is blocked until earlier exam-wide stages and same-slot subject stages are done.
- **Syllabus sign-off** (step 2, `approver = BATCH_TEACHERS`, owned by the Executive, one per subject): the
  Executive sends the exam's chapters for that subject; **every teacher of that subject in the exam's batches**
  (`BatchSubject.employeeId`) must approve. A teacher of several of the exam's batches signs once. A batch with no
  teacher for the subject (or whose teacher is the owner) falls to the subject head, else the Controller. One row
  per signer in `ExamStageSignoff`; the step closes when all are approved/bypassed, and it gates that subject's
  later steps and every later exam-wide step. A teacher **sending back** returns it to the Executive; the others'
  approvals stand, and on resubmission only the objector is asked again — **unless the chapters changed**, in which
  case everyone signs again (an approval only carries over for the chapters it was given for). Changing the chapters
  after sending/closing reopens the step. The Controller can **bypass one teacher** with a reason, and a Controller
  reopen resets every sign-off. The hourly sweep re-works signers (a batch's teacher can change in Academics) and
  reminds/chases teachers who haven't responded.
- **No blueprint step** (removed 2026-11-21): the blueprint comes with the exam template (the New Exam layout).
  Exam types can't add one back. Migration `20261121100100` deleted untouched blueprint stages and bypassed open
  ones with a reason; finished ones stay as history.
- **Evaluation** (one stage per subject, owner role EVALUATOR): on the Evaluation step the exam team picks each
  subject's evaluator and an evaluation window (start/end, not before the exam). The evaluator owns that subject's
  stage and the **end date is its deadline** (otherwise exam date + offset). Results verification waits for every
  subject's evaluation.
- **Student/parent emails are opt-in each time:** marking the exam-notice or results-release step done sends emails
  only if "email students and parents" is ticked (off by default). The portal effects (results visible) happen
  regardless.
- **Results release gate:** students see marks only once `resultsReleasedAt` is set (Controller-only stage;
  reopening hides them again). Untracked exams get it at creation, so their behaviour is unchanged.
- Hourly sweep (`utils/examSweep.ts`): due-in-2-days reminder to the owner, overdue alert to owner + Controller +
  Executive, once each. Student/parent notices (`EXAM_SCHEDULED`, `EXAM_RESULTS_RELEASED`) ship **disabled**
  pending per-school branding.
- Assigned exam stages appear in My To-Do but remain their own records.

### 6.3 Access
All academics features are gated by the permission matrix for every role except Super Admin. Teachers
(EMPLOYEE role) see a view filtered to their own batches.

### 6.5 Curriculum
- Academic Settings → Curriculum. One curriculum per **subject × grade × board** (board is free text, e.g. CBSE,
  ICSE, Foundation, JEE/NEET), holding a **chapter → topic → subtopic** outline in sheet order.
- Built row by row in the app, or imported from xlsx/csv with **Chapter, Topic, Subtopic** columns (found by
  header, so extra columns are ignored). Blank Chapter/Topic cells continue the row above; names repeated under
  the same parent merge (case-insensitive). Import is validated first (dry run); **Replace** swaps the whole
  outline, **Add to it** merges by name and removes nothing. Export produces the same format, so it round-trips.
- Reads are open to every signed-in user; writes need `ACA_SETTINGS` edit, like the rest of Academic Settings.
- The New Exam topics, Assignment topics and Schedule class topics offer the subject's curricula as tick-boxes,
  opening on the grade of the selected batches. Ticked names are stored as plain topic text (commas inside a
  name become " / ", because topics are stored comma-joined) — editing or deleting the curriculum later never
  changes an existing exam.
- Initial data, normalised into `apps/api/seed/curriculum-centum-pow.json` and loaded with
  `node dist/scripts/seed-curriculum.js seed/curriculum-centum-pow.json --apply` (skips curricula that already
  exist):
  - "CENTUM POW" sheet — grades VIII–X twice, as **Foundation** (the "ACE Syllabus" columns; ACE = the Foundation
    programme) and **CBSE**; XI–XII under **JEE/NEET**.
  - "Subject wise POWs – FOUNDATION / New" workbooks — the `Grade 8 ICSE` and `Grade 9 ICSE` sheets as **ICSE**
    (no Grade 10 ICSE sheet exists; Biology's `Grade 8 ICSE (2)` draft is ignored). Workbook/question-paper/project
    rows are dropped, lecture splits ("Force Lec 1…8") fold into one chapter, and teach-ahead chapters stay on the
    sheet's grade tagged "(Grade 9)" / "(Grade 10)".

---

## 7. Resources library
Files, folders, links and videos on the academy's **Google Shared Drive**, reached through a service account
and **always proxied through CADB** (Drive is never shared with users, so private files stay private).
Visibility per resource: **Private** (owner only — not even Super Admin), **All staff**, or **Selected
departments**. Moderators (Edit/Delete/Approve on `RESOURCES`) can hide others' shared resources.
