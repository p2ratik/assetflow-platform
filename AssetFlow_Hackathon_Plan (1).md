# AssetFlow — Project Plan & Module Breakdown

**Stack:** FastAPI (Python) · PostgreSQL on Neon · SQLAlchemy + Alembic · React · Recharts
**Rule #0:** Every feature below must be backed by a real DB row, a real API call, and real business logic. No hardcoded arrays, no fake "success" toasts, no skipped states. If a rule (overlap check, conflict check, workflow gate) isn't enforced server-side, it doesn't count as done.

---

## 1. Architecture

### 1.1 Backend — `backend/app/`

```
app/
├── main.py                     # app factory, router registration, CORS
├── core/
│   ├── config.py               # Settings (Neon URL, JWT secret, etc.) via pydantic-settings
│   ├── database.py             # engine, SessionLocal, Base, get_db dependency
│   ├── security.py             # password hashing (bcrypt), JWT encode/decode
│   └── deps.py                 # get_current_user, require_role([...]) dependency
├── models/                     # one file per entity (SQLAlchemy ORM)
├── schemas/                    # Pydantic request/response models (mirror models)
├── modules/                    # FEATURE-SLICED — this is what gives clean architecture
│   ├── auth/            (router.py, service.py)
│   ├── organization/    # departments, categories, employee directory
│   ├── assets/          # registration, directory, lifecycle
│   ├── allocation/      # allocate, transfer, return
│   ├── booking/         # resource booking + overlap engine
│   ├── maintenance/     # kanban workflow
│   ├── audit/           # audit cycles + discrepancy
│   ├── notifications/
│   ├── activity_log/
│   ├── reports/
│   └── dashboard/       # aggregates from all modules above (build last)
├── utils/
│   ├── tag_generator.py        # AF-000X sequence
│   ├── overlap.py               # interval-overlap SQL helper, reused by booking
│   ├── activity_logger.py      # log_action(db, user, action, entity, entity_id)
│   └── notifier.py             # create_notification(user_id, type, message)
├── jobs/
│   └── scheduler.py            # APScheduler: overdue sweep, booking reminders
├── alembic/                     # migrations — never hand-edit prod schema
└── tests/                      # pytest per module, esp. overlap & conflict rules
```

Every module's `router.py` only does request/response + auth guards; `service.py` holds the actual logic so it's testable without HTTP. This is the "modular design" the hackathon judges will be scoring you on — keep modules from importing each other's internals, only their public service functions.

### 1.2 Frontend — `frontend/src/`

```
src/
├── api/                # one axios client file per module, all real endpoints
├── components/
│   ├── ui/              # Button, Card, Table, Badge, Modal, Tabs — shared kit
│   └── layout/          # Sidebar, Topbar (matches your mockups' left-nav shell)
├── features/            # mirrors backend modules 1:1
│   ├── auth/  dashboard/  organization/  assets/  allocation/
│   ├── booking/  maintenance/  audit/  reports/  notifications/
├── context/AuthContext.jsx   # role + user in context, drives route guards & nav
├── routes/               # role-based protected routes
├── hooks/                # useFetch, usePagination, useForm
└── styles/               # design tokens (dark theme, matches mockups)
```

Build the `ui/` kit first (cards, status badges, tabs, kanban column, calendar grid) — every screen reuses these 5–6 primitives, so building them once early avoids three people styling the same table three different ways.

---

## 2. Data Model (core tables)

| Table | Key columns |
|---|---|
| `users` | id, name, email, password_hash, role (`admin/asset_manager/dept_head/employee`), department_id, status |
| `departments` | id, name, head_id (FK users), parent_dept_id (self-FK), status |
| `categories` | id, name, custom_fields (JSONB, e.g. warranty_period) |
| `assets` | id, tag (AF-000X), name, category_id, serial_number, acquisition_date, acquisition_cost, condition, location, status, is_bookable, photo_url, qr_code |
| `allocations` | id, asset_id, employee_id, department_id, allocated_at, expected_return_date, actual_return_date, status, checkin_notes |
| `transfer_requests` | id, asset_id, requested_by, current_holder, target_holder, status (`requested/approved/rejected`), approved_by |
| `bookings` | id, asset_id, booked_by, start_time, end_time, status (`upcoming/ongoing/completed/cancelled`) |
| `maintenance_requests` | id, asset_id, raised_by, issue, priority, photo_url, status (`pending/approved/rejected/technician_assigned/in_progress/resolved`), technician, approved_by |
| `audit_cycles` | id, scope_department_id, location, date_from, date_to, auditors (M2M), status (`open/closed`) |
| `audit_items` | id, cycle_id, asset_id, expected_location, verification (`verified/missing/damaged`) |
| `notifications` | id, user_id, type, message, is_read, created_at |
| `activity_logs` | id, user_id, action, entity_type, entity_id, timestamp |

Foreign keys everywhere; no denormalized status duplication — asset lifecycle status lives only on `assets.status`, other tables just record events that trigger transitions.

---

## 3. Business Rules That Must Be Real (not just UI)

**Asset lifecycle** (`Available, Allocated, Reserved, Under Maintenance, Lost, Retired, Disposed`)
| Event | Transition |
|---|---|
| Allocate | Available → Allocated |
| Return | Allocated → Available |
| Booking confirmed on a bookable asset | Available → Reserved (for the slot window) |
| Booking ends/cancelled | Reserved → Available |
| Maintenance approved | (any) → Under Maintenance |
| Maintenance resolved | Under Maintenance → Available (per Screen 7 note) |
| Audit closed, item = Missing | → Lost |
| Admin manual action | → Retired → Disposed |

**Allocation conflict:** server checks `assets.status == 'Allocated'` before allocating; if taken, response must include current holder and a `transfer_request` should be creatable from that same rejected response — don't make the frontend guess, return `{blocked: true, held_by: "Priya Shah"}`.

**Booking overlap:** on insert, query existing bookings for that asset where `NOT (new.end <= existing.start OR new.start >= existing.end)` — reject if any row returned. This is a single indexed query; write it once in `utils/overlap.py` and unit test it (9–10 conflicts, 10–11 doesn't, per the mockup example).

**Maintenance workflow:** state machine enforced server-side — you cannot jump Pending → Resolved; each transition is its own endpoint with role guard (Asset Manager approves/rejects; technician assignment and progress updates can be Asset Manager or assigned technician).

**Audit discrepancy:** any `audit_items.verification != 'verified'` auto-populates a discrepancy report (just a filtered query, not a separate hand-maintained table); closing the cycle is a transaction that updates flagged assets' status and locks further edits to that cycle.

**Overdue detection:** don't build a separate "overdue" table — compute it live: `allocations WHERE expected_return_date < now() AND actual_return_date IS NULL`. Same pattern for bookings/dashboard counts. Cheap, always correct, zero drift risk.

**Notifications & activity log are side effects, not screens with their own data entry** — every service function that mutates state (allocate, approve, book, resolve, close audit) calls `log_action()` and, where relevant, `create_notification()`. If you build Screen 10 against a hand-seeded table instead of these hooks, it will look done in a demo and be hollow — avoid that.

---

## 4. Roles & Access

| Role | Can do |
|---|---|
| Admin | Org setup (depts/categories), promote Employee → Dept Head / Asset Manager (only place roles change), view all analytics |
| Asset Manager | Register/allocate assets, approve transfers, approve/route maintenance, resolve audit discrepancies, approve returns |
| Department Head | View dept assets, approve dept-level allocation/transfer requests, book resources for dept |
| Employee | View own assets, book resources, raise maintenance requests, initiate return/transfer |

Signup only ever creates an Employee row — role elevation exists exclusively inside Organization Setup → Employee tab, done by Admin. Enforce this with a dependency (`require_role`) on every mutating route, not just hidden UI buttons.

---

## 5. Screen → Module Map (matches your mockups exactly)

| # | Screen | Backend module | Notes from mockup |
|---|---|---|---|
| 1 | Login/Signup | `auth` | Employee-only signup, forgot password |
| 2 | Dashboard | `dashboard` | KPI cards, overdue banner, quick actions, recent activity feed — build last, it just reads from other modules |
| 3 | Organization Setup | `organization` | 3 tabs: Departments / Categories / Employee; editing a dept live-updates picklists elsewhere |
| 4 | Asset Directory | `assets` | Search by tag/serial/QR, filter chips (Category/Status/Department) |
| 5 | Allocation & Transfer | `allocation` | Conflict block + transfer CTA, return flow with condition notes |
| 6 | Resource Booking | `booking` | Calendar/slot grid, rejected-overlap shown inline like the mockup |
| 7 | Maintenance | `maintenance` | Kanban: Pending/Approved/Technician Assigned/In Progress/Resolved |
| 8 | Audit | `audit` | Cycle header (scope, auditors, date range), per-asset verification, auto discrepancy banner |
| 9 | Reports | `reports` | Utilization bar chart, maintenance frequency line chart, most-used/idle lists, export |
| 10 | Notifications/Logs | `notifications` + `activity_log` | Filter tabs (All/Alerts/Approvals/Bookings) |

---

## 6. Team Split (3 members, vertical ownership)

Each person owns their modules **end-to-end** (DB model → service → API → React feature folder), so no one is blocked waiting on someone else's endpoint. Shared work (schema, auth, UI kit) happens together on day 0.

**Day 0 — together (few hours):** finalize schema/migrations, scaffold both repos, build `auth` module + `AuthContext`, build the shared `ui/` kit (cards, badges, tabs, table, kanban column, calendar grid) so everyone styles against the same primitives.

**Member A — Foundation & Identity**
- Screen 1 (Login/Signup, JWT, role-guarded routes)
- Screen 3 (Organization Setup — all 3 tabs)
- Screen 4 (Asset Registration & Directory, tag/QR generation)
- Screen 2 (Dashboard) — picked up once B & C's modules exist to aggregate

**Member B — Operations**
- Screen 5 (Allocation & Transfer, conflict + transfer workflow, return + check-in)
- Screen 6 (Resource Booking, overlap engine, cancel/reschedule, reminders)

**Member C — Compliance & Insight**
- Screen 7 (Maintenance kanban, full state machine)
- Screen 8 (Audit cycles, discrepancy generation, close-cycle transaction)
- Screen 9 (Reports/Analytics, export)
- Screen 10 (Notifications/Activity Log — wires into everyone's `log_action`/`create_notification` calls, so do this alongside code review with A & B, not in isolation)

**Integration pass (last):** Dashboard KPIs + Notifications feed touch every module — schedule this explicitly as a joint session, not an afterthought, since it's the screen judges see first.

---

## 7. External APIs / Libraries Worth Using

| Need | Recommendation | Why |
|---|---|---|
| Auth | Build your own (python-jose + passlib/bcrypt) | Role-promotion logic is custom business logic (Admin-only elevation) — a third-party auth provider fights this more than it helps |
| File uploads (asset photos, maintenance photos, docs) | **Cloudinary** free tier | Simple SDK both sides, gives you real URLs instead of local disk hacks |
| QR codes | `qrcode` (Python, local generation) | No external API needed — generate on asset registration, store the tag/URL |
| Scheduled jobs (overdue sweep, booking reminders) | **APScheduler** in-process | No infra (Redis/Celery) needed for a hackathon; runs inside your FastAPI process |
| Password-reset / notification emails | **Resend** | Generous free tier, dead-simple API, good deliverability for a demo domain |
| Report export | `openpyxl` (Excel) or `reportlab` (PDF) | Server-generates real files from real query results, not a canned static file |
| Charts | Recharts (frontend) | Already fits your React stack, matches the bar/line charts in Screen 9 |
| DB hosting | Neon Postgres (already chosen) | Branching is genuinely useful mid-hackathon if you want a scratch branch to test migrations |
| Error visibility (stretch) | Sentry free tier | Not a feature ask, but catches the "it worked yesterday" bug fast during demo prep |

---

## 8. Definition of Done (per feature)

- [ ] Backed by a real table/row — no in-memory arrays surviving a refresh
- [ ] Validated server-side (conflict/overlap/state-machine), not just disabled buttons in the UI
- [ ] Role-guarded on the actual route, not just hidden in the nav
- [ ] Triggers real notification + activity log entries where applicable
- [ ] Handles the "reject" path shown in the mockups (conflict banner, overlap banner, missing/damaged flag) — not just the happy path
