from rest_framework import viewsets, permissions
from .models import Skill, JobRole, JobRoleSkill, EmployeeSkillRating, TrainingCalendar, OrgUnit, Tenant, Questionnaire, Question, QuestionChoice, QuestionResponse
from .serializers import SkillSerializer, JobRoleSerializer, JobRoleSkillSerializer, EmployeeSkillRatingSerializer, TrainingCalendarSerializer, OrgUnitSerializer, TenantSerializer, QuestionnaireSerializer, QuestionSerializer, QuestionChoiceSerializer, QuestionResponseSerializer


from django.contrib.auth import get_user_model
from .serializers import UserSerializer
class TenantScopedMixin:
    def get_queryset(self):
        return self.queryset.filter(tenant=self.request.user.tenant)

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

# Tenant ViewSet
class TenantViewSet(viewsets.ModelViewSet):
    queryset = Tenant.objects.all()
    serializer_class = TenantSerializer
    permission_classes = [permissions.IsAuthenticated]

# Questionnaire ViewSet
class QuestionnaireViewSet(TenantScopedMixin, viewsets.ModelViewSet):
    queryset = Questionnaire.objects.all()
    serializer_class = QuestionnaireSerializer
    permission_classes = [permissions.IsAuthenticated]

# Question ViewSet
class QuestionViewSet(viewsets.ModelViewSet):
    queryset = Question.objects.all()
    serializer_class = QuestionSerializer
    permission_classes = [permissions.IsAuthenticated]

# QuestionChoice ViewSet
class QuestionChoiceViewSet(viewsets.ModelViewSet):
    queryset = QuestionChoice.objects.all()
    serializer_class = QuestionChoiceSerializer
    permission_classes = [permissions.IsAuthenticated]


# User ViewSet
class UserViewSet(viewsets.ModelViewSet):
    queryset = get_user_model().objects.all()
    serializer_class = UserSerializer
    permission_classes = [permissions.AllowAny]

# QuestionResponse ViewSet
class QuestionResponseViewSet(viewsets.ModelViewSet):
    queryset = QuestionResponse.objects.all()
    serializer_class = QuestionResponseSerializer
    permission_classes = [permissions.IsAuthenticated]
