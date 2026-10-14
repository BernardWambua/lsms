from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db.models import Count, Q
from django.http import Http404, HttpResponse
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
from .gaps import GapEngine
from . import tna_report


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


class FilterByParamsMixin:
    """Narrows a list by exact-match query parameters, e.g. ?job_role=<id>, for the names in ``filter_params``."""
    filter_params = ()

    def get_queryset(self):
        queryset = super().get_queryset()
        if self.action != 'list':
            return queryset
        filters = {name: self.request.query_params[name] for name in self.filter_params if self.request.query_params.get(name)}
        try:
            return queryset.filter(**filters)
        except (DjangoValidationError, ValueError):
            return queryset.none()


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

class JobRoleSkillViewSet(TenantScopedMixin, FilterByParamsMixin, viewsets.ModelViewSet):
    queryset = JobRoleSkill.objects.order_by('skill__name')
    serializer_class = JobRoleSkillSerializer
    permission_classes = [permissions.IsAuthenticated, IsTenantAdminOrReadOnly]
    filter_params = ('job_role', 'skill')

class EmployeeSkillRatingViewSet(TenantScopedMixin, FilterByParamsMixin, viewsets.ModelViewSet):
    """
    Skill ratings. People record their own self ratings; admins and managers add
    the manager rating to someone else's. Nobody rates their own manager rating,
    and employees only see their own ratings.
    """
    queryset = EmployeeSkillRating.objects.order_by('-survey_date')
    serializer_class = EmployeeSkillRatingSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_params = ('user', 'skill')

    def get_queryset(self):
        queryset = super().get_queryset()
        if not can_view_others_gaps(self.request.user):
            queryset = queryset.filter(user=self.request.user)
        return queryset

    def perform_create(self, serializer):
        if serializer.validated_data.get('manager_rating') is not None:
            raise PermissionDenied("You can't give yourself a manager rating.")
        serializer.save(tenant=self.request.user.tenant, user=self.request.user)

    def perform_update(self, serializer):
        rating, data = serializer.instance, serializer.validated_data
        if rating.user_id == self.request.user.pk:
            if 'manager_rating' in data and data['manager_rating'] != rating.manager_rating:
                raise PermissionDenied("You can't give yourself a manager rating.")
        elif set(data) - {'manager_rating'}:
            raise PermissionDenied("You can only add a manager rating to someone else's rating.")
        serializer.save()

    def perform_destroy(self, instance):
        if instance.user_id != self.request.user.pk and not is_tenant_admin(self.request.user):
            raise PermissionDenied("You can only delete your own ratings.")
        instance.delete()

class TrainingCalendarViewSet(TenantScopedMixin, viewsets.ModelViewSet):
    queryset = TrainingCalendar.objects.all()
    serializer_class = TrainingCalendarSerializer
    permission_classes = [permissions.IsAuthenticated]

class OrgUnitViewSet(TenantScopedMixin, viewsets.ModelViewSet):
    queryset = OrgUnit.objects.all()
    serializer_class = OrgUnitSerializer
    permission_classes = [permissions.IsAuthenticated, IsTenantAdminOrReadOnly]

class OrgStructureView(APIView):
    """
    Admin-only: the tenant's org units as a nested tree, each with its job roles,
    plus the roles that aren't placed in any unit. Super admins pass ?tenant=<id>.
    """
    permission_classes = [permissions.IsAuthenticated, IsSuperAdminOrTenantAdmin]

    def get(self, request):
        if request.user.is_superuser:
            tenant_id = request.query_params.get('tenant')
            if not tenant_id:
                return Response({'tenant': ['This parameter is required.']}, status=status.HTTP_400_BAD_REQUEST)
            try:
                tenant = get_object_or_404(Tenant, pk=tenant_id)
            except DjangoValidationError:
                raise Http404
        else:
            tenant = request.user.tenant

        units = list(scope_to_tenant(OrgUnit.objects.order_by('name'), tenant.pk))
        roles = list(scope_to_tenant(JobRole.objects.order_by('title'), tenant.pk))

        roles_by_unit = {}
        for role in roles:
            roles_by_unit.setdefault(role.org_unit_id, []).append(
                {'id': role.pk, 'title': role.title, 'description': role.description}
            )
        children_by_parent = {}
        for unit in units:
            children_by_parent.setdefault(unit.parent_id, []).append(unit)

        visited = set()

        def build(unit):
            visited.add(unit.pk)
            return {
                'id': unit.pk,
                'name': unit.name,
                'job_roles': roles_by_unit.get(unit.pk, []),
                'children': [build(child) for child in children_by_parent.get(unit.pk, []) if child.pk not in visited],
            }

        unit_ids = {unit.pk for unit in units}
        tree = [build(unit) for unit in units if unit.parent_id is None or unit.parent_id not in unit_ids]
        # A unit whose parent chain loops back on itself has no root; show it at the top level rather than lose it.
        tree += [build(unit) for unit in units if unit.pk not in visited]

        return Response({
            'tenant': {'id': tenant.pk, 'name': tenant.name},
            'units': tree,
            'unassigned_job_roles': roles_by_unit.get(None, []),
        })

def can_view_others_gaps(user):
    return user.is_superuser or (user.tenant_id is not None and user.role in ('admin', 'manager'))


class IsGapReviewer(permissions.BasePermission):
    """Super admins, and admins and managers within their own tenant, can see anyone's gaps."""

    def has_permission(self, request, view):
        return can_view_others_gaps(request.user)


def get_tenant_object(request, model, pk):
    """Look up ``model`` by ``pk`` inside the requester's tenant (any tenant for super admins); 404 otherwise."""
    queryset = model.objects.all()
    if not request.user.is_superuser:
        queryset = scope_to_tenant(queryset, request.user.tenant_id)
    try:
        return get_object_or_404(queryset, pk=pk)
    except DjangoValidationError:
        raise Http404


class MyGapsView(APIView):
    """The logged-in person's skill gaps against their job role."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        if request.user.tenant is None:
            return Response({'detail': 'Super admins have no job role to measure.'}, status=status.HTTP_404_NOT_FOUND)
        return Response(GapEngine(request.user.tenant).person(request.user))


class PersonGapsView(APIView):
    """One person's skill gaps. People can see their own; admins and managers can see anyone in their tenant."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, pk):
        person = get_tenant_object(request, get_user_model(), pk)
        if person.pk != request.user.pk and not can_view_others_gaps(request.user):
            raise PermissionDenied("You can only view your own skill gaps.")
        if person.tenant is None:
            raise Http404
        return Response(GapEngine(person.tenant).person(person))


class DepartmentGapsView(APIView):
    """Gaps for everyone in an org unit and the units below it, with a breakdown by sub-unit."""
    permission_classes = [permissions.IsAuthenticated, IsGapReviewer]

    def get(self, request, pk):
        unit = get_tenant_object(request, OrgUnit, pk)
        return Response(GapEngine(unit.tenant).department(unit))


class InstitutionGapsView(APIView):
    """Gaps across the whole institution, with a breakdown by top-level unit. Super admins pass ?tenant=<id>."""
    permission_classes = [permissions.IsAuthenticated, IsGapReviewer]

    def get(self, request):
        if request.user.is_superuser:
            tenant_id = request.query_params.get('tenant')
            if not tenant_id:
                return Response({'tenant': ['This parameter is required.']}, status=status.HTTP_400_BAD_REQUEST)
            tenant = get_tenant_object(request, Tenant, tenant_id)
        else:
            tenant = request.user.tenant
        return Response(GapEngine(tenant).institution())


class TNAReportView(APIView):
    """
    The TNA report for the institution, or for one department with ?unit=<id>.
    ?period=2026/27 labels the financial year (defaults to the current one);
    ?download=pdf or ?download=xlsx returns the file instead of JSON.
    Super admins pass ?tenant=<id>.
    """
    permission_classes = [permissions.IsAuthenticated, IsGapReviewer]
    RENDERERS = {
        'pdf': (tna_report.render_pdf, 'application/pdf'),
        'xlsx': (tna_report.render_xlsx, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'),
    }

    def get(self, request):
        params = request.query_params
        period = params.get('period') or None
        if period and not tna_report.PERIOD_PATTERN.match(period):
            return Response({'period': ['Use a financial year such as 2026/27.']}, status=status.HTTP_400_BAD_REQUEST)
        download = params.get('download')
        if download and download not in self.RENDERERS:
            return Response({'download': ['Use pdf or xlsx.']}, status=status.HTTP_400_BAD_REQUEST)

        unit = get_tenant_object(request, OrgUnit, params['unit']) if params.get('unit') else None
        if unit is not None:
            tenant = unit.tenant
        elif request.user.is_superuser:
            if not params.get('tenant'):
                return Response({'tenant': ['This parameter is required.']}, status=status.HTTP_400_BAD_REQUEST)
            tenant = get_tenant_object(request, Tenant, params['tenant'])
        else:
            tenant = request.user.tenant

        report = tna_report.build_report(GapEngine(tenant), unit=unit, period=period)
        if not download:
            return Response(report)
        render, content_type = self.RENDERERS[download]
        response = HttpResponse(render(report), content_type=content_type)
        response['Content-Disposition'] = f'attachment; filename="{tna_report.filename(report, download)}"'
        return response


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
# Questionnaires, their questions and choices: everyone in the tenant can read them, admins write them.
class QuestionnaireViewSet(TenantScopedMixin, viewsets.ModelViewSet):
    queryset = Questionnaire.objects.order_by('-created_at')
    serializer_class = QuestionnaireSerializer
    permission_classes = [permissions.IsAuthenticated, IsTenantAdminOrReadOnly]

# Question ViewSet (tenant comes from the questionnaire)
class QuestionViewSet(TenantScopedMixin, FilterByParamsMixin, viewsets.ModelViewSet):
    queryset = Question.objects.order_by('text')
    serializer_class = QuestionSerializer
    permission_classes = [permissions.IsAuthenticated, IsTenantAdminOrReadOnly]
    filter_params = ('questionnaire',)

    def perform_create(self, serializer):
        serializer.save()

# QuestionChoice ViewSet (tenant comes from the question's questionnaire)
class QuestionChoiceViewSet(TenantScopedMixin, FilterByParamsMixin, viewsets.ModelViewSet):
    queryset = QuestionChoice.objects.order_by('id')
    serializer_class = QuestionChoiceSerializer
    permission_classes = [permissions.IsAuthenticated, IsTenantAdminOrReadOnly]
    filter_params = ('question', 'question__questionnaire')

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
            for field in ('role', 'is_active', 'job_role')
        )
        if not can_manage_users(user):
            if serializer.instance.pk != user.pk:
                raise PermissionDenied('You can only edit your own account.')
            if changes_access:
                raise PermissionDenied('Only tenant admins can change roles, job roles or deactivate users.')
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
# Answers to a rating question that is linked to a skill also record the person's
# self rating for that skill, so questionnaires feed the gap engine.
class QuestionResponseViewSet(TenantScopedMixin, FilterByParamsMixin, viewsets.ModelViewSet):
    queryset = QuestionResponse.objects.order_by('-submitted_at')
    serializer_class = QuestionResponseSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_params = ('question', 'question__questionnaire', 'user')

    def get_queryset(self):
        queryset = super().get_queryset()
        if not can_view_others_gaps(self.request.user):
            queryset = queryset.filter(user=self.request.user)
        return queryset

    def perform_create(self, serializer):
        response = serializer.save(user=self.request.user)
        question = response.question
        if question.question_type == 'rating' and question.skill_id and response.response_rating is not None:
            record_self_rating(self.request.user, question.skill, response.response_rating)

    def perform_update(self, serializer):
        if serializer.instance.user_id != self.request.user.pk:
            raise PermissionDenied('You can only change your own answers.')
        serializer.save()

    def perform_destroy(self, instance):
        if instance.user_id != self.request.user.pk and not is_tenant_admin(self.request.user):
            raise PermissionDenied('You can only delete your own answers.')
        instance.delete()


def record_self_rating(user, skill, level):
    """Records today's self rating for ``skill``, updating today's rating if there is one so each day has one rating."""
    today = timezone.localdate()
    rating = EmployeeSkillRating.objects.filter(user=user, skill=skill, survey_date=today).first()
    if rating:
        rating.self_rating = level
        rating.save(update_fields=['self_rating'])
        return rating
    return EmployeeSkillRating.objects.create(tenant=user.tenant, user=user, skill=skill, self_rating=level, survey_date=today)
