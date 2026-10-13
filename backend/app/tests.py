import datetime

from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from .models import (
    Tenant, OrgUnit, JobRole, Skill, JobRoleSkill, EmployeeSkillRating, TrainingCalendar,
    Questionnaire, Question, QuestionChoice, QuestionResponse,
)

User = get_user_model()
PASSWORD = 'a-Strong-pass-123'
FAST_HASHER = override_settings(PASSWORD_HASHERS=['django.contrib.auth.hashers.MD5PasswordHasher'])


def make_tenant_data(tenant, user):
    """Create one of every tenant-owned object for ``tenant``."""
    org_unit = OrgUnit.objects.create(tenant=tenant, name=f'{tenant.name} HQ')
    job_role = JobRole.objects.create(tenant=tenant, org_unit=org_unit, title=f'{tenant.name} Engineer')
    skill = Skill.objects.create(tenant=tenant, name=f'{tenant.name} Python', difficulty=3, usage_frequency=4, impact_if_missing=5)
    questionnaire = Questionnaire.objects.create(tenant=tenant, title=f'{tenant.name} Survey', org_unit=org_unit)
    question = Question.objects.create(questionnaire=questionnaire, text='How good are you?', skill=skill)
    return {
        'org-units': org_unit,
        'job-roles': job_role,
        'skills': skill,
        'job-role-skills': JobRoleSkill.objects.create(tenant=tenant, job_role=job_role, skill=skill),
        'ratings': EmployeeSkillRating.objects.create(tenant=tenant, user=user, skill=skill, self_rating=3, survey_date=datetime.date(2026, 1, 1)),
        'training-calendar': TrainingCalendar.objects.create(tenant=tenant, skill=skill, training_title='Intro', scheduled_date=datetime.date(2026, 2, 1), format='online', created_by=user),
        'questionnaires': questionnaire,
        'questions': question,
        'question-choices': QuestionChoice.objects.create(question=question, text='Very'),
        'question-responses': QuestionResponse.objects.create(question=question, user=user, response_rating=4),
    }


@FAST_HASHER
class TenantTestCase(TestCase):
    def setUp(self):
        self.tenant_a = Tenant.objects.create(name='Acme')
        self.tenant_b = Tenant.objects.create(name='Globex')
        self.admin_a = User.objects.create_user(username='admin_a', password=PASSWORD, tenant=self.tenant_a, role='admin')
        self.user_a = User.objects.create_user(username='user_a', password=PASSWORD, tenant=self.tenant_a)
        self.user_b = User.objects.create_user(username='user_b', password=PASSWORD, tenant=self.tenant_b)
        self.data_a = make_tenant_data(self.tenant_a, self.user_a)
        self.data_b = make_tenant_data(self.tenant_b, self.user_b)
        self.client = APIClient()

    def login(self, user):
        self.client.force_authenticate(user=user)

    def ids(self, response):
        self.assertEqual(response.status_code, 200, response.content)
        return {str(row['id']) for row in response.json()}


class AuthenticationRequiredTests(TenantTestCase):
    ENDPOINTS = [
        'skills', 'job-roles', 'job-role-skills', 'ratings', 'training-calendar', 'org-units',
        'tenants', 'questionnaires', 'questions', 'question-choices', 'question-responses', 'users',
    ]

    def test_anonymous_cannot_list_anything(self):
        for endpoint in self.ENDPOINTS:
            with self.subTest(endpoint=endpoint):
                response = self.client.get(f'/api/{endpoint}/')
                self.assertEqual(response.status_code, 401)

    def test_anonymous_cannot_read_a_user(self):
        response = self.client.get(f'/api/users/{self.user_a.pk}/')
        self.assertEqual(response.status_code, 401)

    def test_anonymous_cannot_create_tenant_data(self):
        response = self.client.post('/api/org-units/', {'name': 'Sneaky'})
        self.assertEqual(response.status_code, 401)


class TenantIsolationTests(TenantTestCase):
    def test_lists_only_show_own_tenant(self):
        self.login(self.user_a)
        for endpoint, obj in self.data_a.items():
            with self.subTest(endpoint=endpoint):
                ids = self.ids(self.client.get(f'/api/{endpoint}/'))
                self.assertIn(str(obj.pk), ids)
                self.assertNotIn(str(self.data_b[endpoint].pk), ids)

    def test_other_tenants_objects_are_not_found(self):
        self.login(self.user_a)
        for endpoint, obj in self.data_b.items():
            with self.subTest(endpoint=endpoint):
                self.assertEqual(self.client.get(f'/api/{endpoint}/{obj.pk}/').status_code, 404)
                self.assertEqual(self.client.patch(f'/api/{endpoint}/{obj.pk}/', {}).status_code, 404)
                self.assertEqual(self.client.delete(f'/api/{endpoint}/{obj.pk}/').status_code, 404)
        self.assertTrue(OrgUnit.objects.filter(pk=self.data_b['org-units'].pk).exists())

    def test_users_list_only_shows_own_tenant(self):
        self.login(self.user_a)
        ids = self.ids(self.client.get('/api/users/'))
        self.assertEqual(ids, {str(self.admin_a.pk), str(self.user_a.pk)})

    def test_tenants_list_only_shows_own_tenant(self):
        self.login(self.user_a)
        self.assertEqual(self.ids(self.client.get('/api/tenants/')), {str(self.tenant_a.pk)})
        self.assertEqual(self.client.get(f'/api/tenants/{self.tenant_b.pk}/').status_code, 404)

    def test_create_assigns_own_tenant_even_if_another_is_sent(self):
        self.login(self.user_a)
        response = self.client.post('/api/org-units/', {'name': 'Ops', 'tenant': str(self.tenant_b.pk)})
        self.assertEqual(response.status_code, 201, response.content)
        self.assertEqual(OrgUnit.objects.get(pk=response.json()['id']).tenant, self.tenant_a)

    def test_update_cannot_move_object_to_another_tenant(self):
        self.login(self.user_a)
        org_unit = self.data_a['org-units']
        response = self.client.patch(f'/api/org-units/{org_unit.pk}/', {'tenant': str(self.tenant_b.pk)})
        self.assertEqual(response.status_code, 200, response.content)
        org_unit.refresh_from_db()
        self.assertEqual(org_unit.tenant, self.tenant_a)

    def test_cannot_reference_another_tenants_objects(self):
        self.login(self.user_a)
        response = self.client.post('/api/job-role-skills/', {
            'job_role': str(self.data_a['job-roles'].pk),
            'skill': str(self.data_b['skills'].pk),
        })
        self.assertEqual(response.status_code, 400)
        self.assertIn('skill', response.json())

    def test_cannot_add_question_to_another_tenants_questionnaire(self):
        self.login(self.user_a)
        response = self.client.post('/api/questions/', {
            'questionnaire': str(self.data_b['questionnaires'].pk),
            'text': 'Injected?',
        })
        self.assertEqual(response.status_code, 400)
        self.assertFalse(Question.objects.filter(text='Injected?').exists())

    def test_cannot_add_choice_to_another_tenants_question(self):
        self.login(self.user_a)
        response = self.client.post('/api/question-choices/', {
            'question': str(self.data_b['questions'].pk),
            'text': 'Injected',
        })
        self.assertEqual(response.status_code, 400)

    def test_response_is_recorded_for_the_requesting_user(self):
        self.login(self.user_a)
        response = self.client.post('/api/question-responses/', {
            'question': str(self.data_a['questions'].pk),
            'user': str(self.user_b.pk),
            'response_rating': 5,
        })
        self.assertEqual(response.status_code, 201, response.content)
        self.assertEqual(QuestionResponse.objects.get(pk=response.json()['id']).user, self.user_a)

    def test_cannot_respond_to_another_tenants_question(self):
        self.login(self.user_a)
        response = self.client.post('/api/question-responses/', {
            'question': str(self.data_b['questions'].pk),
            'response_rating': 5,
        })
        self.assertEqual(response.status_code, 400)


class TenantEndpointTests(TenantTestCase):
    def test_employee_cannot_edit_tenant(self):
        self.login(self.user_a)
        response = self.client.patch(f'/api/tenants/{self.tenant_a.pk}/', {'name': 'Renamed'})
        self.assertEqual(response.status_code, 403)

    def test_admin_can_edit_own_tenant(self):
        self.login(self.admin_a)
        response = self.client.patch(f'/api/tenants/{self.tenant_a.pk}/', {'name': 'Acme Ltd'})
        self.assertEqual(response.status_code, 200, response.content)
        self.tenant_a.refresh_from_db()
        self.assertEqual(self.tenant_a.name, 'Acme Ltd')

    def test_tenants_cannot_be_created_or_deleted_through_the_api(self):
        self.login(self.admin_a)
        self.assertEqual(self.client.post('/api/tenants/', {'name': 'New'}).status_code, 405)
        self.assertEqual(self.client.delete(f'/api/tenants/{self.tenant_a.pk}/').status_code, 405)


class UserEndpointTests(TenantTestCase):
    def signup(self, **overrides):
        payload = {
            'username': 'newbie', 'email': 'newbie@example.com', 'password': PASSWORD,
            'tenant': str(self.tenant_a.pk), 'role': 'employee',
        }
        payload.update(overrides)
        return APIClient().post('/api/users/', payload)

    def test_signup_creates_a_user_who_can_log_in(self):
        response = self.signup()
        self.assertEqual(response.status_code, 201, response.content)
        self.assertNotIn('password', response.json())
        token = APIClient().post('/api/token/', {'username': 'newbie', 'password': PASSWORD})
        self.assertEqual(token.status_code, 200, token.content)
        self.assertIn('access', token.json())

    def test_signup_cannot_self_assign_admin(self):
        response = self.signup(role='admin')
        self.assertEqual(response.status_code, 201, response.content)
        self.assertEqual(User.objects.get(username='newbie').role, 'employee')

    def test_signup_requires_a_password(self):
        response = self.signup(password='')
        self.assertEqual(response.status_code, 400)

    def test_employee_cannot_add_users(self):
        self.login(self.user_a)
        response = self.client.post('/api/users/', {'username': 'x', 'password': PASSWORD})
        self.assertEqual(response.status_code, 403)

    def test_admin_adds_users_to_own_tenant(self):
        self.login(self.admin_a)
        response = self.client.post('/api/users/', {'username': 'hire', 'password': PASSWORD, 'tenant': str(self.tenant_b.pk)})
        self.assertEqual(response.status_code, 201, response.content)
        self.assertEqual(User.objects.get(username='hire').tenant, self.tenant_a)

    def test_user_can_edit_self_but_not_role(self):
        self.login(self.user_a)
        response = self.client.patch(f'/api/users/{self.user_a.pk}/', {'first_name': 'Ann'})
        self.assertEqual(response.status_code, 200, response.content)
        response = self.client.patch(f'/api/users/{self.user_a.pk}/', {'role': 'admin'})
        self.assertEqual(response.status_code, 403)
        self.user_a.refresh_from_db()
        self.assertEqual((self.user_a.first_name, self.user_a.role), ('Ann', 'employee'))

    def test_user_cannot_move_self_to_another_tenant(self):
        self.login(self.user_a)
        self.client.patch(f'/api/users/{self.user_a.pk}/', {'tenant': str(self.tenant_b.pk)})
        self.user_a.refresh_from_db()
        self.assertEqual(self.user_a.tenant, self.tenant_a)

    def test_user_cannot_edit_or_delete_colleagues(self):
        self.login(self.user_a)
        self.assertEqual(self.client.patch(f'/api/users/{self.admin_a.pk}/', {'first_name': 'X'}).status_code, 403)
        self.assertEqual(self.client.delete(f'/api/users/{self.admin_a.pk}/').status_code, 403)

    def test_admin_can_promote_and_delete_users(self):
        self.login(self.admin_a)
        response = self.client.patch(f'/api/users/{self.user_a.pk}/', {'role': 'manager'})
        self.assertEqual(response.status_code, 200, response.content)
        self.assertEqual(self.client.delete(f'/api/users/{self.user_a.pk}/').status_code, 204)

    def test_password_change_is_hashed(self):
        self.login(self.user_a)
        self.client.patch(f'/api/users/{self.user_a.pk}/', {'password': 'another-Pass-456'})
        self.user_a.refresh_from_db()
        self.assertTrue(self.user_a.check_password('another-Pass-456'))


class ModelTests(TestCase):
    def test_importance_score_is_mean_of_skill_factors(self):
        tenant = Tenant.objects.create(name='Acme')
        skill = Skill.objects.create(tenant=tenant, name='SQL', difficulty=2, usage_frequency=4, impact_if_missing=6)
        job_role = JobRole.objects.create(tenant=tenant, title='Analyst')
        link = JobRoleSkill.objects.create(tenant=tenant, job_role=job_role, skill=skill)
        self.assertEqual(link.importance_score, 4)
        self.assertEqual(str(link), 'Analyst - SQL (Importance: 4.0)')


class TokenTests(TenantTestCase):
    def test_token_endpoints_are_public(self):
        response = self.client.post('/api/token/', {'username': 'user_a', 'password': PASSWORD})
        self.assertEqual(response.status_code, 200, response.content)
        refresh = self.client.post('/api/token/refresh/', {'refresh': response.json()['refresh']})
        self.assertEqual(refresh.status_code, 200, refresh.content)

    def test_jwt_grants_access(self):
        access = self.client.post('/api/token/', {'username': 'user_a', 'password': PASSWORD}).json()['access']
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {access}')
        self.assertEqual(self.ids(self.client.get('/api/skills/')), {str(self.data_a['skills'].pk)})
