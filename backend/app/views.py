from django.contrib.auth import get_user_model
from rest_framework import viewsets, permissions, mixins
from rest_framework.exceptions import PermissionDenied

from .models import Skill, JobRole, JobRoleSkill, EmployeeSkillRating, TrainingCalendar, OrgUnit, Tenant, Questionnaire, Question, QuestionChoice, QuestionResponse
from .serializers import SkillSerializer, JobRoleSerializer, JobRoleSkillSerializer, EmployeeSkillRatingSerializer, TrainingCalendarSerializer, OrgUnitSerializer, TenantSerializer, QuestionnaireSerializer, QuestionSerializer, QuestionChoiceSerializer, QuestionResponseSerializer, UserSerializer
from .tenancy import scope_to_tenant


def is_tenant_admin(user):
    return user.is_authenticated and (user.role == 'admin' or user.is_superuser)


class TenantScopedMixin:
    """Limits every request to rows belonging to the requesting user's tenant."""

    def get_queryset(self):
        return scope_to_tenant(super().get_queryset(), self.request.user.tenant_id)

    def perform_create(self, serializer):
        serializer.save(tenant=self.request.user.tenant)


class SkillViewSet(TenantScopedMixin, viewsets.ModelViewSet):
    queryset = Skill.objects.all()
    serializer_class = SkillSerializer
    permission_classes = [permissions.IsAuthenticated]

class JobRoleViewSet(TenantScopedMixin, viewsets.ModelViewSet):
    queryset = JobRole.objects.all()
    serializer_class = JobRoleSerializer
    permission_classes = [permissions.IsAuthenticated]

class JobRoleSkillViewSet(TenantScopedMixin, viewsets.ModelViewSet):
    queryset = JobRoleSkill.objects.all()
    serializer_class = JobRoleSkillSerializer
    permission_classes = [permissions.IsAuthenticated]

class EmployeeSkillRatingViewSet(TenantScopedMixin, viewsets.ModelViewSet):
    queryset = EmployeeSkillRating.objects.all()
    serializer_class = EmployeeSkillRatingSerializer
    permission_classes = [permissions.IsAuthenticated]

class TrainingCalendarViewSet(TenantScopedMixin, viewsets.ModelViewSet):
    queryset = TrainingCalendar.objects.all()
    serializer_class = TrainingCalendarSerializer
    permission_classes = [permissions.IsAuthenticated]

class OrgUnitViewSet(TenantScopedMixin, viewsets.ModelViewSet):
    queryset = OrgUnit.objects.all()
    serializer_class = OrgUnitSerializer
    permission_classes = [permissions.IsAuthenticated]

# Tenant ViewSet: users can see their own tenant, and tenant admins can edit it.
# Tenants are created and deleted through the Django admin.
class TenantViewSet(mixins.RetrieveModelMixin, mixins.UpdateModelMixin, mixins.ListModelMixin, viewsets.GenericViewSet):
    queryset = Tenant.objects.all()
    serializer_class = TenantSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return super().get_queryset().filter(id=self.request.user.tenant_id)

    def perform_update(self, serializer):
        if not is_tenant_admin(self.request.user):
            raise PermissionDenied('Only tenant admins can edit the tenant.')
        serializer.save()

# Questionnaire ViewSet
class QuestionnaireViewSet(TenantScopedMixin, viewsets.ModelViewSet):
    queryset = Questionnaire.objects.all()
    serializer_class = QuestionnaireSerializer
    permission_classes = [permissions.IsAuthenticated]

# Question ViewSet (tenant comes from the questionnaire)
class QuestionViewSet(TenantScopedMixin, viewsets.ModelViewSet):
    queryset = Question.objects.all()
    serializer_class = QuestionSerializer
    permission_classes = [permissions.IsAuthenticated]

    def perform_create(self, serializer):
        serializer.save()

# QuestionChoice ViewSet (tenant comes from the question's questionnaire)
class QuestionChoiceViewSet(TenantScopedMixin, viewsets.ModelViewSet):
    queryset = QuestionChoice.objects.all()
    serializer_class = QuestionChoiceSerializer
    permission_classes = [permissions.IsAuthenticated]

    def perform_create(self, serializer):
        serializer.save()


class SignupOrAuthenticated(permissions.BasePermission):
    """Anyone may sign up (POST to the collection); everything else needs a login."""

    def has_permission(self, request, view):
        return view.action == 'create' or bool(request.user and request.user.is_authenticated)


# User ViewSet
class UserViewSet(TenantScopedMixin, viewsets.ModelViewSet):
    queryset = get_user_model().objects.all()
    serializer_class = UserSerializer
    permission_classes = [SignupOrAuthenticated]

    def perform_create(self, serializer):
        user = self.request.user
        if user.is_authenticated:
            if not is_tenant_admin(user):
                raise PermissionDenied('Only tenant admins can add users.')
            serializer.save(tenant=user.tenant)
        else:
            # Self-service signup always starts as an employee.
            serializer.save(role='employee')

    def perform_update(self, serializer):
        user = self.request.user
        if not is_tenant_admin(user):
            if serializer.instance.pk != user.pk:
                raise PermissionDenied('You can only edit your own account.')
            if 'role' in serializer.validated_data and serializer.validated_data['role'] != user.role:
                raise PermissionDenied('Only tenant admins can change roles.')
        serializer.save()

    def perform_destroy(self, instance):
        if not is_tenant_admin(self.request.user):
            raise PermissionDenied('Only tenant admins can delete users.')
        instance.delete()

# QuestionResponse ViewSet (tenant comes from the question's questionnaire)
class QuestionResponseViewSet(TenantScopedMixin, viewsets.ModelViewSet):
    queryset = QuestionResponse.objects.all()
    serializer_class = QuestionResponseSerializer
    permission_classes = [permissions.IsAuthenticated]

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)
