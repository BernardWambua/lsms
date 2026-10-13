import datetime
from datetime import timedelta

from django.contrib.auth import get_user_model
from django.core import mail
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from .models import (
    Tenant, OrgUnit, JobRole, Skill, JobRoleSkill, EmployeeSkillRating, TrainingCalendar,
    Questionnaire, Question, QuestionChoice, QuestionResponse, Invitation,
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
        'tenants', 'questionnaires', 'questions', 'question-choices', 'question-responses', 'users', 'invitations',
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
        self.login(self.admin_a)
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
        self.login(self.admin_a)
        response = self.client.post('/api/org-units/', {'name': 'Ops', 'tenant': str(self.tenant_b.pk)})
        self.assertEqual(response.status_code, 201, response.content)
        self.assertEqual(OrgUnit.objects.get(pk=response.json()['id']).tenant, self.tenant_a)

    def test_update_cannot_move_object_to_another_tenant(self):
        self.login(self.admin_a)
        org_unit = self.data_a['org-units']
        response = self.client.patch(f'/api/org-units/{org_unit.pk}/', {'tenant': str(self.tenant_b.pk)})
        self.assertEqual(response.status_code, 200, response.content)
        org_unit.refresh_from_db()
        self.assertEqual(org_unit.tenant, self.tenant_a)

    def test_cannot_reference_another_tenants_objects(self):
        self.login(self.admin_a)
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


class StructurePermissionTests(TenantTestCase):
    def test_employees_can_read_but_not_change_structure(self):
        self.login(self.user_a)
        for endpoint in ('org-units', 'job-roles', 'skills', 'job-role-skills'):
            with self.subTest(endpoint=endpoint):
                obj = self.data_a[endpoint]
                self.assertEqual(self.client.get(f'/api/{endpoint}/{obj.pk}/').status_code, 200)
                self.assertEqual(self.client.post(f'/api/{endpoint}/', {}).status_code, 403)
                self.assertEqual(self.client.patch(f'/api/{endpoint}/{obj.pk}/', {}).status_code, 403)
                self.assertEqual(self.client.delete(f'/api/{endpoint}/{obj.pk}/').status_code, 403)

    def test_admin_builds_org_structure(self):
        self.login(self.admin_a)
        parent = self.client.post('/api/org-units/', {'name': 'Engineering'}).json()['id']
        child = self.client.post('/api/org-units/', {'name': 'Platform', 'parent': parent})
        self.assertEqual(child.status_code, 201, child.content)
        role = self.client.post('/api/job-roles/', {'title': 'SRE', 'org_unit': child.json()['id']})
        self.assertEqual(role.status_code, 201, role.content)
        skill = self.client.post('/api/skills/', {'name': 'Kubernetes', 'type': 'technical', 'difficulty': 4, 'usage_frequency': 5, 'impact_if_missing': 5})
        self.assertEqual(skill.status_code, 201, skill.content)


class TenantEndpointTests(TenantTestCase):
    def setUp(self):
        super().setUp()
        self.superadmin = User.objects.create_superuser(username='root', password=PASSWORD, email='root@example.com')

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

    def test_tenant_admins_cannot_create_or_delete_tenants(self):
        self.login(self.admin_a)
        self.assertEqual(self.client.post('/api/tenants/', {'name': 'New'}).status_code, 403)
        self.assertEqual(self.client.delete(f'/api/tenants/{self.tenant_a.pk}/').status_code, 403)
        self.assertEqual(Tenant.objects.count(), 2)

    def test_super_admin_creates_tenant_and_invites_its_first_admin(self):
        self.login(self.superadmin)
        response = self.client.post('/api/tenants/', {'name': 'Initech', 'admin_email': 'boss@initech.com'})
        self.assertEqual(response.status_code, 201, response.content)
        tenant = Tenant.objects.get(name='Initech')
        invitation = Invitation.objects.get(tenant=tenant)
        self.assertEqual((invitation.email, invitation.role, invitation.invited_by), ('boss@initech.com', 'admin', self.superadmin))
        self.assertEqual(len(mail.outbox), 1)
        self.assertIn(invitation.token, mail.outbox[0].body)

    def test_super_admin_sees_and_deletes_any_tenant(self):
        self.login(self.superadmin)
        self.assertEqual(self.ids(self.client.get('/api/tenants/')), {str(self.tenant_a.pk), str(self.tenant_b.pk)})
        self.assertEqual(self.client.delete(f'/api/tenants/{self.tenant_b.pk}/').status_code, 204)


class InvitationTests(TenantTestCase):
    def invite(self, user, **payload):
        self.login(user)
        return self.client.post('/api/invitations/', {'email': 'new@acme.com', **payload})

    def accept(self, token, **overrides):
        payload = {'username': 'newbie', 'password': PASSWORD, 'first_name': 'New'}
        payload.update(overrides)
        return APIClient().post(f'/api/invitations/accept/{token}/', payload)

    def test_admin_invites_into_own_tenant_and_email_is_sent(self):
        response = self.invite(self.admin_a, role='manager', tenant=str(self.tenant_b.pk))
        self.assertEqual(response.status_code, 201, response.content)
        invitation = Invitation.objects.get(email='new@acme.com')
        self.assertEqual((invitation.tenant, invitation.role, invitation.invited_by), (self.tenant_a, 'manager', self.admin_a))
        self.assertEqual(response.json()['status'], 'pending')
        self.assertIn(invitation.token, response.json()['accept_url'])
        self.assertEqual(mail.outbox[0].to, ['new@acme.com'])

    def test_employee_cannot_invite(self):
        self.assertEqual(self.invite(self.user_a).status_code, 403)

    def test_anonymous_cannot_invite(self):
        self.assertEqual(APIClient().post('/api/invitations/', {'email': 'x@y.com'}).status_code, 401)

    def test_cannot_invite_an_existing_users_email(self):
        self.user_b.email = 'taken@globex.com'
        self.user_b.save()
        self.assertEqual(self.invite(self.admin_a, email='Taken@Globex.com').status_code, 400)

    def test_admins_only_see_own_tenants_invitations(self):
        Invitation.objects.create(tenant=self.tenant_b, email='b@globex.com')
        mine = Invitation.objects.create(tenant=self.tenant_a, email='a@acme.com')
        self.login(self.admin_a)
        self.assertEqual(self.ids(self.client.get('/api/invitations/')), {str(mine.pk)})

    def test_admin_can_revoke_an_invitation(self):
        invitation = Invitation.objects.create(tenant=self.tenant_a, email='a@acme.com')
        self.login(self.admin_a)
        self.assertEqual(self.client.delete(f'/api/invitations/{invitation.pk}/').status_code, 204)
        self.assertEqual(self.accept(invitation.token).status_code, 410)

    def test_preview_shows_who_is_inviting(self):
        invitation = Invitation.objects.create(tenant=self.tenant_a, email='a@acme.com', role='manager')
        response = APIClient().get(f'/api/invitations/accept/{invitation.token}/')
        self.assertEqual(response.json(), {'tenant_name': 'Acme', 'email': 'a@acme.com', 'role': 'manager'})
        self.assertEqual(APIClient().get('/api/invitations/accept/nope/').status_code, 404)

    def test_accepting_creates_user_in_the_invited_tenant(self):
        invitation = Invitation.objects.create(tenant=self.tenant_a, email='a@acme.com', role='manager')
        response = self.accept(invitation.token, tenant=str(self.tenant_b.pk), role='admin')
        self.assertEqual(response.status_code, 201, response.content)
        user = User.objects.get(username='newbie')
        self.assertEqual((user.tenant, user.role, user.email), (self.tenant_a, 'manager', 'a@acme.com'))
        token = APIClient().post('/api/token/', {'username': 'newbie', 'password': PASSWORD})
        self.assertEqual(token.status_code, 200, token.content)

    def test_invitation_works_only_once(self):
        invitation = Invitation.objects.create(tenant=self.tenant_a, email='a@acme.com')
        self.assertEqual(self.accept(invitation.token).status_code, 201)
        self.assertEqual(self.accept(invitation.token, username='second').status_code, 410)
        self.assertEqual(APIClient().get(f'/api/invitations/accept/{invitation.token}/').status_code, 410)

    def test_expired_invitation_is_refused(self):
        invitation = Invitation.objects.create(tenant=self.tenant_a, email='a@acme.com', expires_at=timezone.now() - timedelta(minutes=1))
        self.assertEqual(self.accept(invitation.token).status_code, 410)
        self.assertFalse(User.objects.filter(username='newbie').exists())

    def test_weak_password_and_taken_username_are_rejected(self):
        invitation = Invitation.objects.create(tenant=self.tenant_a, email='a@acme.com')
        self.assertIn('password', self.accept(invitation.token, password='123').json())
        self.assertIn('username', self.accept(invitation.token, username='USER_A').json())
        invitation.refresh_from_db()
        self.assertIsNone(invitation.accepted_at)

    def test_first_user_in_a_tenant_becomes_admin(self):
        empty = Tenant.objects.create(name='Initech')
        invitation = Invitation.objects.create(tenant=empty, email='first@initech.com', role='employee')
        self.assertEqual(self.accept(invitation.token).status_code, 201)
        self.assertEqual(User.objects.get(username='newbie').role, 'admin')

    def test_new_admin_can_invite_others(self):
        empty = Tenant.objects.create(name='Initech')
        invitation = Invitation.objects.create(tenant=empty, email='first@initech.com', role='admin')
        self.accept(invitation.token)
        response = self.invite(User.objects.get(username='newbie'), email='second@initech.com')
        self.assertEqual(response.status_code, 201, response.content)
        self.assertEqual(Invitation.objects.get(email='second@initech.com').tenant, empty)


class UserEndpointTests(TenantTestCase):
    def test_there_is_no_public_signup(self):
        response = APIClient().post('/api/users/', {
            'username': 'newbie', 'password': PASSWORD, 'tenant': str(self.tenant_a.pk), 'role': 'admin',
        })
        self.assertEqual(response.status_code, 401)
        self.assertFalse(User.objects.filter(username='newbie').exists())

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

    def test_me_returns_the_logged_in_user(self):
        self.login(self.admin_a)
        data = self.client.get('/api/users/me/').json()
        self.assertEqual((data['username'], data['role'], data['tenant'], data['is_superuser']), ('admin_a', 'admin', str(self.tenant_a.pk), False))
        self.assertEqual(APIClient().get('/api/users/me/').status_code, 401)

    def test_admin_can_deactivate_users_but_employees_cannot(self):
        self.login(self.user_a)
        self.assertEqual(self.client.patch(f'/api/users/{self.user_a.pk}/', {'is_active': False}).status_code, 403)
        self.login(self.admin_a)
        self.assertEqual(self.client.patch(f'/api/users/{self.user_a.pk}/', {'is_active': False}).status_code, 200)
        self.user_a.refresh_from_db()
        self.assertFalse(self.user_a.is_active)

    def test_admin_cannot_lock_themselves_out(self):
        self.login(self.admin_a)
        self.assertEqual(self.client.patch(f'/api/users/{self.admin_a.pk}/', {'role': 'employee'}).status_code, 403)
        self.assertEqual(self.client.patch(f'/api/users/{self.admin_a.pk}/', {'is_active': False}).status_code, 403)
        self.assertEqual(self.client.delete(f'/api/users/{self.admin_a.pk}/').status_code, 403)
        self.assertEqual(self.client.patch(f'/api/users/{self.admin_a.pk}/', {'first_name': 'Ada'}).status_code, 200)


class SuperAdminTests(TenantTestCase):
    def setUp(self):
        super().setUp()
        self.superadmin = User.objects.create_superuser(username='root', password=PASSWORD, email='root@example.com')
        self.login(self.superadmin)

    def test_tenant_list_includes_counts(self):
        Invitation.objects.create(tenant=self.tenant_a, email='pending@acme.com')
        Invitation.objects.create(tenant=self.tenant_a, email='old@acme.com', expires_at=timezone.now() - timedelta(days=1))
        acme = next(t for t in self.client.get('/api/tenants/').json() if t['name'] == 'Acme')
        self.assertEqual(
            (acme['user_count'], acme['org_unit_count'], acme['job_role_count'], acme['skill_count'], acme['pending_invitation_count']),
            (2, 1, 1, 1, 1),
        )

    def test_reads_every_tenants_data_and_can_filter_by_tenant(self):
        everything = self.ids(self.client.get('/api/org-units/'))
        self.assertEqual(everything, {str(self.data_a['org-units'].pk), str(self.data_b['org-units'].pk)})
        only_b = self.ids(self.client.get(f'/api/users/?tenant={self.tenant_b.pk}'))
        self.assertEqual(only_b, {str(self.user_b.pk)})
        only_a = self.ids(self.client.get(f'/api/invitations/?tenant={self.tenant_a.pk}'))
        self.assertEqual(only_a, set())

    def test_cannot_change_organisation_data(self):
        org_unit = self.data_a['org-units']
        self.assertEqual(self.client.post('/api/org-units/', {'name': 'X'}).status_code, 403)
        self.assertEqual(self.client.patch(f'/api/org-units/{org_unit.pk}/', {'name': 'X'}).status_code, 403)
        self.assertEqual(self.client.delete(f'/api/org-units/{org_unit.pk}/').status_code, 403)

    def test_can_manage_users_in_any_tenant(self):
        response = self.client.patch(f'/api/users/{self.user_b.pk}/', {'role': 'admin'})
        self.assertEqual(response.status_code, 200, response.content)
        self.user_b.refresh_from_db()
        self.assertEqual(self.user_b.role, 'admin')

    def test_can_invite_into_any_tenant(self):
        response = self.client.post('/api/invitations/', {'email': 'new@globex.com', 'role': 'admin', 'tenant': str(self.tenant_b.pk)})
        self.assertEqual(response.status_code, 201, response.content)
        self.assertEqual(Invitation.objects.get(email='new@globex.com').tenant, self.tenant_b)

    def test_me_has_no_tenant(self):
        data = self.client.get('/api/users/me/').json()
        self.assertEqual((data['is_superuser'], data['tenant']), (True, None))


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
