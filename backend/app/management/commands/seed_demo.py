"""
Load a made-up institution for demos: the Kenya public service pack, staff and
a sample competency framework loaded through the importers, skill ratings, and
a training plan generated from the gaps. All of it is invented data.

    python manage.py seed_demo                 # create "Demo State Department"
    python manage.py seed_demo --reset         # delete it first and start again
    python manage.py seed_demo --samples DIR   # also save the filled import files to DIR
"""

import datetime
import random
from decimal import Decimal
from pathlib import Path

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone

from app import demo_data, imports, training_plan
from app.gaps import GapEngine
from app.models import EmployeeSkillRating, JobRoleSkill, Tenant, TrainingPlan
from app.packs import apply_pack
from app.tna_report import financial_year

DEFAULT_NAME = 'Demo State Department'


class Command(BaseCommand):
    help = 'Create a demo institution filled with invented staff, competencies, ratings and a training plan.'

    def add_arguments(self, parser):
        parser.add_argument('--name', default=DEFAULT_NAME, help='Name of the demo organisation.')
        parser.add_argument('--password', default='Demo-pass-2026', help='Password for the demo logins.')
        parser.add_argument('--reset', action='store_true', help='Delete an existing organisation with this name first.')
        parser.add_argument('--samples', metavar='DIR', help='Also save the filled staff and competency import files here.')

    def handle(self, *args, name, password, reset, samples, **options):
        existing = Tenant.objects.filter(name=name)
        if existing.exists():
            if not reset:
                raise CommandError(f'"{name}" already exists. Pass --reset to delete it and start again.')
            existing.delete()

        with transaction.atomic():
            tenant = Tenant.objects.create(name=name)
            apply_pack(tenant, 'kenya_public_service')
            staff = imports.StaffImporter(tenant).run(demo_data.staff_sheets(), commit=True)
            competencies = imports.CompetencyImporter(tenant).run(demo_data.competency_sheets(), commit=True)
            self.check_import('Staff', staff)
            self.check_import('Competency', competencies)
            self.check_import('Role requirement', competencies['requirements'])
            logins = self.set_up_logins(tenant, password)
            ratings = self.rate(tenant)
            plan = self.plan(tenant, logins['admin'])

        self.stdout.write(self.style.SUCCESS(f'Created "{tenant.name}".'))
        self.stdout.write(f"  {staff['counts']['created']} officers, {competencies['counts']['created']} competencies, "
                          f"{competencies['requirements']['counts']['created']} role requirements, {ratings} ratings")
        self.stdout.write(f'  Training plan {plan.period}: {plan.programmes.count()} programmes')
        self.stdout.write(f'  Logins (password "{password}"):')
        for role, user in logins.items():
            self.stdout.write(f'    {role:<9} {user.username}  ({user.get_full_name()}, {user.job_role.title})')

        if samples:
            folder = Path(samples)
            folder.mkdir(parents=True, exist_ok=True)
            files = {
                'sample-staff-import.xlsx': demo_data.filled_template(imports.staff_template(tenant), demo_data.staff_sheets()),
                'sample-competency-import.xlsx': demo_data.filled_template(imports.competency_template(tenant), demo_data.competency_sheets()),
            }
            for filename, data in files.items():
                (folder / filename).write_bytes(data)
                self.stdout.write(f'  Saved {folder / filename}')

    def check_import(self, label, result):
        errors = [row for row in result['rows'] if row['action'] == 'error']
        if errors:
            raise CommandError(f'{label} rows failed to import: {errors[:3]}')

    def set_up_logins(self, tenant, password):
        User = get_user_model()
        _, numbers = demo_data.staff_rows()
        logins = {}
        for role, number in numbers.items():
            user = User.objects.get(tenant=tenant, staff_number=number)
            user.set_password(password)
            user.save(update_fields=['password'])
            logins[role] = user
        return logins

    def rate(self, tenant, seed=11):
        """Self ratings for most required skills, and manager ratings for about half, a little below the requirement on average."""
        rng = random.Random(seed)
        today = timezone.localdate()
        required = {}
        for requirement in JobRoleSkill.objects.filter(tenant=tenant):
            required.setdefault(requirement.job_role_id, []).append(requirement)
        ratings = []
        for person in get_user_model().objects.filter(tenant=tenant).exclude(job_role=None):
            for requirement in required.get(person.job_role_id, []):
                if rng.random() > 0.85:
                    continue  # Not assessed yet, so the report shows incomplete coverage.
                self_rating = max(1, min(5, requirement.required_level + rng.choice([-2, -1, -1, 0, 0, 1])))
                manager_rating = max(1, min(5, self_rating + rng.choice([-1, -1, 0, 0, 1]))) if rng.random() < 0.5 else None
                ratings.append(EmployeeSkillRating(
                    tenant=tenant, user=person, skill_id=requirement.skill_id, self_rating=self_rating,
                    manager_rating=manager_rating, survey_date=today - datetime.timedelta(days=rng.randint(1, 60)),
                ))
        EmployeeSkillRating.objects.bulk_create(ratings)
        return len(ratings)

    def plan(self, tenant, hr):
        plan = TrainingPlan.objects.create(
            tenant=tenant, period=financial_year(), title=f'{tenant.name} training plan', budget=Decimal('6500000'),
            default_fee=Decimal('35000'), default_allowance_per_day=Decimal('8400'), default_duration_days=5, created_by=hr,
        )
        training_plan.generate_from_gaps(plan, GapEngine(tenant), nominated_by=hr)
        return plan
