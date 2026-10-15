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

List endpoints accept filters: `job-role-skills?job_role=`, `ratings?user=&skill=`, `questions?questionnaire=`, `question-choices?question=` or `?question__questionnaire=`, `question-responses?question=&question__questionnaire=&user=`.

## Conventions

- Every model has a UUID primary key and a `tenant` foreign key. API viewsets use `TenantScopedMixin` so each user only sees and creates data for their own tenant.
- Each API resource is a DRF `ModelViewSet` registered in `backend/app/urls.py` with a plural kebab-case route (`job-roles`, `org-units`).
- The frontend calls the API only through the shared axios instance in `frontend/src/api.js`, which attaches the JWT from sessionStorage.
- UI uses MUI components styled with the `sx` prop; components live in `frontend/src/components/`.
