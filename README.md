# LSMS: Learning and Skill Management Solution

A multi-tenant web app that helps companies map their organisation (org units and job roles), define the skills each role needs, collect employee and manager skill ratings through questionnaires, and plan training around the gaps.

## Layout

```
backend/    Django 5.2 + Django REST Framework API (JWT auth, PostgreSQL, or SQLite for quick local runs)
frontend/   React 19 app (Create React App, MUI, React Router, axios)
```

## Running locally

### Backend (http://localhost:8000)

```bash
cd backend
py -3.12 -m venv .venv
.venv\Scripts\activate          # macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py createsuperuser
python manage.py runserver
```

For a demo, `python manage.py seed_demo` loads **Demo State Department**, an invented institution with 36 officers, a sample competency framework, ratings and a training plan, and prints the demo logins (HR admin, manager and employee). `--reset` rebuilds it; `--samples <folder>` also saves the filled staff and competency import files for trying the upload yourself. All of it is made-up data. It gets a Standard licence for the current financial year; `--plan pilot` gives it the free pilot instead, so the TNA report carries the evaluation watermark.

Settings come from environment variables; see `backend/.env.example`. Without them the app runs with development defaults.

The API lives under `/api/`. Get a token with `POST /api/token/` and send it as `Authorization: Bearer <token>`.

### Database (PostgreSQL)

The backend uses PostgreSQL when `DATABASE_URL` is set and a local SQLite file (`backend/db.sqlite3`) when it isn't, so a quick local run needs no database server.

To use PostgreSQL locally (Windows, after installing PostgreSQL with its installer):

```powershell
# Create a database and a user for LSMS (psql asks for the postgres password you set when installing)
psql -U postgres -c "CREATE USER lsms WITH PASSWORD 'choose-a-password' CREATEDB;"
psql -U postgres -c "CREATE DATABASE lsms OWNER lsms;"

# Point the backend at it (this terminal only; use setx DATABASE_URL "..." to keep it, then open a new terminal)
$env:DATABASE_URL = "postgres://lsms:choose-a-password@localhost:5432/lsms"

cd backend
.venv\Scripts\activate
pip install -r requirements.txt
python manage.py migrate
```

If the password has characters such as `@`, `:` or `/`, percent-encode them in the URL (`@` becomes `%40`). `CREATEDB` lets `python manage.py test` create its test database.

#### Moving existing SQLite data to PostgreSQL

Run these on the same branch and code as the data you're moving, so both databases have the same migrations.

```powershell
cd backend
.venv\Scripts\activate

# 1. Export from SQLite: make sure DATABASE_URL is NOT set in this terminal
Remove-Item Env:DATABASE_URL -ErrorAction SilentlyContinue
python -X utf8 manage.py dumpdata --natural-foreign --natural-primary --exclude contenttypes --exclude auth.permission --exclude admin.logentry --exclude sessions --indent 1 -o lsms-data.json

# 2. Create the tables in PostgreSQL (the database must be empty), then load the export
$env:DATABASE_URL = "postgres://lsms:choose-a-password@localhost:5432/lsms"
python manage.py migrate
python -X utf8 manage.py loaddata lsms-data.json
```

`-X utf8` keeps names with accents or other non-English characters intact on Windows. Accounts, passwords, ratings, plans and import history all come across. Keep `db.sqlite3` until you've checked the app on PostgreSQL, and delete `lsms-data.json` afterwards because it contains password hashes.

### Frontend (http://localhost:3000)

```bash
cd frontend
copy .env.example .env          # macOS/Linux: cp .env.example .env
npm install
npm start
```

## Accounts and organisations

There is no public signup. People get accounts in one of three ways:

1. **Super admin creates an organisation.** In Django admin (`/admin/`), add a Tenant and an invitation for its first admin in the same form, or `POST /api/tenants/` with `name` and `admin_email`. Super admins (created with `createsuperuser`) don't belong to any tenant.
2. **Tenant admin invites people.** From the app's "Invite people" page, or `POST /api/invitations/` with `email` and `role`. The invite is emailed and the link is shown on that page; it works once and expires after 7 days.
3. **Tenant admin adds a user directly** with `POST /api/users/` (username, password, role).

Invite links open `/accept-invite/<token>` in the frontend, where the person picks a username and password. The first person to join an organisation always becomes its admin.

Invitation emails print to the backend console unless SMTP is configured (see `backend/.env.example`).

## Skill gaps (Training Needs Assessment)

Each job role has a skill profile (`/api/job-role-skills/`): the proficiency level the role requires (1 Awareness to 5 Expert) and, optionally, its own difficulty, importance and frequency (DIF) scores for that skill. DIF scores left blank fall back to the skill's. People are placed in a post through `job_role` on `/api/users/`; their department is that role's org unit.

The gap engine (`backend/app/gaps.py`) compares the profile with each person's latest rating, preferring the manager's rating over the self rating:

- **gap** = required level minus current level, never below 0
- **priority score** = gap x mean DIF score (0 to 20; 8+ high, 4+ medium)
- **gap score** = DIF-weighted shortfall as a percentage of DIF-weighted required levels (0 = all requirements met)

Skills nobody has rated are reported as not assessed and left out of the scores; `assessment_coverage` shows how much of the profile has been rated.

| Endpoint | Who | Returns |
| --- | --- | --- |
| `GET /api/gaps/me/` | anyone in a tenant | your gaps per skill |
| `GET /api/gaps/people/<id>/` | yourself, or admins and managers | one person's gaps per skill |
| `GET /api/gaps/departments/<org unit id>/` | admins and managers | the unit and everything below it: staff, coverage, gap score, ranked training needs per skill, people, sub-unit breakdown |
| `GET /api/gaps/institution/` | admins and managers (super admins add `?tenant=<id>`) | the same for the whole institution, by top-level unit |

### Collecting ratings

- **Self ratings:** people rate themselves on the skills their role requires on **My skills** (`/my-skills`), or by answering a questionnaire. A rating question linked to a skill records the answer as that person's self rating. Each person has at most one rating per skill per day; rating again the same day updates it.
- **Manager ratings:** admins and managers review people on **Staff ratings** (`/ratings`) and add a manager rating to each person's latest rating. Nobody can give themselves a manager rating, and employees only see their own ratings and answers.
- **Questionnaires** (`/questionnaires`) are built by admins: questions are rating (1 to 5), multiple choice, true/false or text. Everyone else can read and answer them.
- **Role profiles:** open a job role (`/job-roles/<id>`) to set the skills it requires, the level, and any role-specific DIF scores. Admins place people in job roles on the People page.

### TNA report

Admins and managers open **TNA report** (`/reports/tna`) to preview the Training Needs Assessment for the whole institution or one department and download it as PDF or Excel. The report is built from the gap engine (`backend/app/tna_report.py`) and follows the usual public-service TNA layout: executive summary, methodology, organisational (department), occupational (job role) and individual analysis, prioritised training needs, recommendations, a sign-off block for the Head of HRM&D and the Authorised Officer, and an annex of training projections (officers to train per skill, highest priority first) for the Human Resource Management Advisory Committee.

`GET /api/reports/tna/` returns the report as JSON. Parameters: `unit=<org unit id>` for one department and the units below it, `period=2026/27` for the financial year (defaults to the current July to June year), `download=pdf` or `download=xlsx` for a file, and `tenant=<id>` for super admins.

List endpoints accept filters: `job-role-skills?job_role=`, `ratings?user=&skill=`, `questions?questionnaire=`, `question-choices?question=` or `?question__questionnaire=`, `question-responses?question=&question__questionnaire=&user=`.

## Staff records, imports and sector packs

LSMS stays general: the models know **grades**, **job families**, **competency frameworks** and **staff numbers**, and each organisation names them in its own words (`Tenant.terminology`, edited on **Classification > Wording**; `GET /api/users/me/` returns the merged `terms`). A **sector pack** (`backend/app/packs.py`) fills these in when an organisation is created: the *Kenya public service* pack loads Job Groups A to T, common cadres and the wording "Job Group", "Cadre", "P/F No." and "MDA". A blank organisation keeps the generic words.

Each person can carry a staff record: staff number (unique per organisation, shown as P/F No. in the TNA report and training plan), supervisor, grade, job family, terms of service, date of appointment, gender, disability, and `extra` for other HR columns. National ID, date of birth and ethnicity are deliberately not stored.

**Import** (`/imports`, admins only) loads two kinds of spreadsheet, each with a downloadable Excel template:

- **Staff**: one row per officer. Matched on staff number (or email the first time), so the same file can be uploaded again whenever HR updates it. Departments (written as a path, `Finance Directorate > Accounts Division`), posts, grades and job families that don't exist yet are created. Header names from HR exports (`PF No.`, `Surname`, `Job Group`, `Cadre`, `Reports To`...) are recognised, and unknown columns are kept in `extra`. Nobody is deleted; people missing from the file are listed for HR to deactivate. Imported staff have no password until they're given one.
- **Competency framework**: the competencies (matched on code within their framework), plus an optional *Role requirements* sheet with the level each post requires, which becomes the post's skill profile.

Every upload is checked first (`POST /api/imports/<staff|competencies>/` with `file`): the response says what each row would do and nothing is saved. Sending `commit=true` runs the import and records it (`GET /api/import-runs/`). Templates: `GET /api/imports/<kind>/template/`. Grades, job families and frameworks also have their own endpoints: `/api/grades/`, `/api/job-families/`, `/api/competency-frameworks/`.

## Licences

Each organisation holds one annual licence (`License`, managed by super admins in Django admin under **Licenses**; nothing is billed automatically). The rules live in `backend/app/licensing.py`.

- **Plans**: every new organisation starts on a free **Pilot** for 180 days; its TNA report PDF and Excel carry an evaluation watermark. **Standard** and **Enterprise** are paid and unwatermarked. Organisations that existed before licensing were given a Standard licence for the current financial year.
- **Staff bands** set the most active staff an organisation can have: Small 300, Medium 1,500, Large 5,000, or no limit. Inviting, adding or reactivating someone, accepting an invitation, or a staff import (already at the check step) is refused once the band is full.
- **Term**: usually the financial year, 1 July to 30 June, set when the LPO arrives. After `ends_on` the organisation keeps full access for `grace_days` (30 by default), then becomes **read-only**: everyone can still sign in, view everything and download reports, but changes are refused. Ticking **suspended** makes it read-only straight away. Super admins are never blocked.
- `GET /api/license/` returns the plan, term, state, days left and staff used (`?tenant=<id>` for super admins). Admins see the licence at **Admin > Licence** and a banner from 60 days before it ends; everyone sees a banner while it is read-only.
- Every API view lists `HasWritableLicense` in its `permission_classes` (a test checks), which is what makes a lapsed licence read-only.

## Conventions

- Every model has a UUID primary key and a `tenant` foreign key. API viewsets use `TenantScopedMixin` so each user only sees and creates data for their own tenant.
- Each API resource is a DRF `ModelViewSet` registered in `backend/app/urls.py` with a plural kebab-case route (`job-roles`, `org-units`).
- The frontend calls the API only through the shared axios instance in `frontend/src/api.js`, which attaches the JWT from sessionStorage.
- UI uses MUI components styled with the `sx` prop; components live in `frontend/src/components/`.
