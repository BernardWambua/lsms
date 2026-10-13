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

## Conventions

- Every model has a UUID primary key and a `tenant` foreign key. API viewsets use `TenantScopedMixin` so each user only sees and creates data for their own tenant.
- Each API resource is a DRF `ModelViewSet` registered in `backend/app/urls.py` with a plural kebab-case route (`job-roles`, `org-units`).
- The frontend calls the API only through the shared axios instance in `frontend/src/api.js`, which attaches the JWT from sessionStorage.
- UI uses MUI components styled with the `sx` prop; components live in `frontend/src/components/`.
