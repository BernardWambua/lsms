from django.contrib.auth import get_user_model
from django.shortcuts import get_object_or_404
from rest_framework import viewsets, permissions, mixins, status
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Skill, JobRole, JobRoleSkill, EmployeeSkillRating, TrainingCalendar, OrgUnit, Tenant, Questionnaire, Question, QuestionChoice, QuestionResponse, Invitation
from .serializers import SkillSerializer, JobRoleSerializer, JobRoleSkillSerializer, EmployeeSkillRatingSerializer, TrainingCalendarSerializer, OrgUnitSerializer, TenantSerializer, QuestionnaireSerializer, QuestionSerializer, QuestionChoiceSerializer, QuestionResponseSerializer, UserSerializer, InvitationSerializer, AcceptInvitationSerializer
from .invitations import create_invitation, accept_invitation, InvitationUnavailable
from .tenancy import scope_to_tenant


def is_tenant_admin(user):
    return user.is_authenticated and user.tenant_id is not None and user.role == 'admin'


class IsSuperAdminOrTenantAdmin(permissions.BasePermission):
    def has_permission(self, request, view):
        return bool(request.user and (request.user.is_superuser or is_tenant_admin(request.user)))


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

# Tenant ViewSet: super admins create and manage organisations; everyone else
# sees only their own, and its admins can edit it.
class TenantViewSet(viewsets.ModelViewSet):
    queryset = Tenant.objects.all()
    serializer_class = TenantSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        if self.request.user.is_superuser:
            return super().get_queryset()
        return super().get_queryset().filter(id=self.request.user.tenant_id)

    def perform_create(self, serializer):
        if not self.request.user.is_superuser:
            raise PermissionDenied('Only super admins can create organisations.')
        admin_email = serializer.validated_data.pop('admin_email', None)
        tenant = serializer.save()
        if admin_email:
            create_invitation(tenant, admin_email, 'admin', invited_by=self.request.user)

    def perform_update(self, serializer):
        if not (self.request.user.is_superuser or is_tenant_admin(self.request.user)):
            raise PermissionDenied('Only tenant admins can edit the organisation.')
        serializer.save()

    def perform_destroy(self, instance):
        if not self.request.user.is_superuser:
            raise PermissionDenied('Only super admins can delete organisations.')
        instance.delete()

# Invitation ViewSet: tenant admins invite people into their own tenant;
# super admins can invite into any tenant (e.g. its first admin).
class InvitationViewSet(mixins.CreateModelMixin, mixins.ListModelMixin, mixins.RetrieveModelMixin, mixins.DestroyModelMixin, viewsets.GenericViewSet):
    queryset = Invitation.objects.select_related('tenant').order_by('-created_at')
    serializer_class = InvitationSerializer
    permission_classes = [permissions.IsAuthenticated, IsSuperAdminOrTenantAdmin]

    def get_queryset(self):
        if self.request.user.is_superuser:
            return super().get_queryset()
        return super().get_queryset().filter(tenant=self.request.user.tenant_id)

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        tenant = serializer.validated_data.get('tenant') if request.user.is_superuser else request.user.tenant
        if tenant is None:
            return Response({'tenant': ['This field is required.']}, status=status.HTTP_400_BAD_REQUEST)
        invitation = create_invitation(tenant, serializer.validated_data['email'], serializer.validated_data.get('role', 'employee'), invited_by=request.user)
        return Response(self.get_serializer(invitation).data, status=status.HTTP_201_CREATED)


class AcceptInvitationView(APIView):
    """Public: look up an invitation by its token, and accept it by choosing a username and password."""
    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    def get(self, request, token):
        invitation = get_object_or_404(Invitation.objects.select_related('tenant'), token=token)
        if not invitation.is_pending:
            return Response({'detail': 'This invitation has already been used or has expired.'}, status=status.HTTP_410_GONE)
        return Response({'tenant_name': invitation.tenant.name, 'email': invitation.email, 'role': invitation.role})

    def post(self, request, token):
        serializer = AcceptInvitationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            user = accept_invitation(token, **serializer.validated_data)
        except InvitationUnavailable:
            return Response({'detail': 'This invitation is invalid, has already been used or has expired.'}, status=status.HTTP_410_GONE)
        return Response(UserSerializer(user).data, status=status.HTTP_201_CREATED)

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


# User ViewSet
class UserViewSet(TenantScopedMixin, viewsets.ModelViewSet):
    queryset = get_user_model().objects.all()
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated]

    # There is no public signup: people join through an invitation, or a tenant admin adds them here.
    def perform_create(self, serializer):
        if not is_tenant_admin(self.request.user):
            raise PermissionDenied('Only tenant admins can add users.')
        serializer.save(tenant=self.request.user.tenant)

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
