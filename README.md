# LSMS: Learning and Skill Management Solution

A multi-tenant web app that helps companies map their organisation (org units and job roles), define the skills each role needs, collect employee and manager skill ratings through questionnaires, and plan training around the gaps.

## Layout

```
backend/    Django 5.2 + Django REST Framework API (JWT auth, SQLite in dev)
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

## Conventions

- Every model has a UUID primary key and a `tenant` foreign key. API viewsets use `TenantScopedMixin` so each user only sees and creates data for their own tenant.
- Each API resource is a DRF `ModelViewSet` registered in `backend/app/urls.py` with a plural kebab-case route (`job-roles`, `org-units`).
- The frontend calls the API only through the shared axios instance in `frontend/src/api.js`, which attaches the JWT from sessionStorage.
- UI uses MUI components styled with the `sx` prop; components live in `frontend/src/components/`.
