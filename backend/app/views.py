from django.contrib.auth import get_user_model
from django.db.models import Count, Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import viewsets, permissions, mixins, status
from rest_framework.decorators import action
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


class IsTenantAdminOrReadOnly(permissions.BasePermission):
    """Anyone in the tenant can read; only its admins can change the organisation's structure."""

    def has_permission(self, request, view):
        return request.method in permissions.SAFE_METHODS or is_tenant_admin(request.user)


def can_manage_users(user):
    return user.is_superuser or is_tenant_admin(user)


class TenantScopedMixin:
    """
    Limits every request to rows belonging to the requesting user's tenant.
    Super admins can read every tenant's rows (narrowed with ?tenant=<id>),
    but only change them where a viewset sets ``superadmin_can_write``.
    """
    superadmin_can_write = False

    def check_permissions(self, request):
        super().check_permissions(request)
        if request.user.is_superuser and request.method not in permissions.SAFE_METHODS and not self.superadmin_can_write:
            raise PermissionDenied('Super admins can view organisation data but not change it.')

    def get_queryset(self):
        queryset = super().get_queryset()
        user = self.request.user
        if user.is_superuser:
            tenant_id = self.request.query_params.get('tenant')
            return scope_to_tenant(queryset, tenant_id) if tenant_id else queryset
        return scope_to_tenant(queryset, user.tenant_id)

    def perform_create(self, serializer):
        serializer.save(tenant=self.request.user.tenant)


class SkillViewSet(TenantScopedMixin, viewsets.ModelViewSet):
    queryset = Skill.objects.all()
    serializer_class = SkillSerializer
    permission_classes = [permissions.IsAuthenticated, IsTenantAdminOrReadOnly]

class JobRoleViewSet(TenantScopedMixin, viewsets.ModelViewSet):
    queryset = JobRole.objects.all()
    serializer_class = JobRoleSerializer
    permission_classes = [permissions.IsAuthenticated, IsTenantAdminOrReadOnly]

class JobRoleSkillViewSet(TenantScopedMixin, viewsets.ModelViewSet):
    queryset = JobRoleSkill.objects.all()
    serializer_class = JobRoleSkillSerializer
    permission_classes = [permissions.IsAuthenticated, IsTenantAdminOrReadOnly]

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
    permission_classes = [permissions.IsAuthenticated, IsTenantAdminOrReadOnly]

# Tenant ViewSet: super admins create and manage organisations; everyone else
# sees only their own, and its admins can edit it.
class TenantViewSet(viewsets.ModelViewSet):
    queryset = Tenant.objects.all()
    serializer_class = TenantSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        queryset = super().get_queryset().annotate(
            user_count=Count('user', distinct=True),
            org_unit_count=Count('orgunit', distinct=True),
            job_role_count=Count('jobrole', distinct=True),
            skill_count=Count('skill', distinct=True),
            pending_invitation_count=Count(
                'invitations', distinct=True,
                filter=Q(invitations__accepted_at__isnull=True, invitations__expires_at__gt=timezone.now()),
            ),
        ).order_by('name')
        if self.request.user.is_superuser:
            return queryset
        return queryset.filter(id=self.request.user.tenant_id)

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
        queryset = super().get_queryset()
        if self.request.user.is_superuser:
            tenant_id = self.request.query_params.get('tenant')
            return queryset.filter(tenant=tenant_id) if tenant_id else queryset
        return queryset.filter(tenant=self.request.user.tenant_id)

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
    superadmin_can_write = True

    def get_queryset(self):
        return super().get_queryset().order_by('username')

    @action(detail=False, methods=['get'])
    def me(self, request):
        """The logged-in user, so the frontend knows who they are and what they can do."""
        return Response(self.get_serializer(request.user).data)

    # There is no public signup: people join through an invitation, or a tenant admin adds them here.
    def perform_create(self, serializer):
        if not is_tenant_admin(self.request.user):
            raise PermissionDenied('Only tenant admins can add users.')
        serializer.save(tenant=self.request.user.tenant)

    def perform_update(self, serializer):
        user = self.request.user
        changes_access = any(
            field in serializer.validated_data and serializer.validated_data[field] != getattr(serializer.instance, field)
            for field in ('role', 'is_active')
        )
        if not can_manage_users(user):
            if serializer.instance.pk != user.pk:
                raise PermissionDenied('You can only edit your own account.')
            if changes_access:
                raise PermissionDenied('Only tenant admins can change roles or deactivate users.')
        elif changes_access and serializer.instance.pk == user.pk:
            raise PermissionDenied("You can't change your own role or deactivate yourself.")
        serializer.save()

    def perform_destroy(self, instance):
        if not can_manage_users(self.request.user):
            raise PermissionDenied('Only tenant admins can delete users.')
        if instance.pk == self.request.user.pk:
            raise PermissionDenied("You can't delete your own account.")
        instance.delete()

# QuestionResponse ViewSet (tenant comes from the question's questionnaire)
class QuestionResponseViewSet(TenantScopedMixin, viewsets.ModelViewSet):
    queryset = QuestionResponse.objects.all()
    serializer_class = QuestionResponseSerializer
    permission_classes = [permissions.IsAuthenticated]

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)
