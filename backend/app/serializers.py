from rest_framework import serializers
from .models import Grade, JobFamily, CompetencyFramework, ImportRun, Skill, JobRole, JobRoleSkill, EmployeeSkillRating, TrainingCalendar, OrgUnit, Tenant, Questionnaire, Question, QuestionResponse, QuestionChoice, Invitation, TrainingPlan, TrainingProgramme, TrainingNomination, TrainingEvaluation
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password as run_password_validators
from django.core.exceptions import ValidationError as DjangoValidationError
from .invitations import accept_url
from .tenancy import scope_to_tenant
from . import training_plan
from .tna_report import PERIOD_PATTERN
from .gaps import priority_label
from .packs import PACK_CHOICES, apply_pack, terms_for


class TenantScopedSerializer(serializers.ModelSerializer):
    """
    Makes ``tenant`` read-only (the view sets it) and limits every related-object
    field to objects in the requesting user's tenant, so one tenant can't point
    at, or probe for, another tenant's data.
    """

    def get_fields(self):
        fields = super().get_fields()
        if 'tenant' in fields:
            fields['tenant'] = serializers.PrimaryKeyRelatedField(read_only=True)

        request = self.context.get('request')
        user = getattr(request, 'user', None)
        if user is None or not user.is_authenticated:
            return fields

        for field in fields.values():
            related = getattr(field, 'child_relation', field)
            if isinstance(related, serializers.RelatedField) and related.queryset is not None:
                related.queryset = scope_to_tenant(related.queryset, user.tenant_id)
        return fields


class SkillSerializer(TenantScopedSerializer):
    class Meta:
        model = Skill
        fields = '__all__'

class JobRoleSerializer(TenantScopedSerializer):
    class Meta:
        model = JobRole
        fields = '__all__'

class JobRoleSkillSerializer(TenantScopedSerializer):
    importance_score = serializers.FloatField(read_only=True)

    class Meta:
        model = JobRoleSkill
        fields = '__all__'

    def validate(self, attrs):
        job_role = attrs.get('job_role', getattr(self.instance, 'job_role', None))
        skill = attrs.get('skill', getattr(self.instance, 'skill', None))
        duplicates = JobRoleSkill.objects.filter(job_role=job_role, skill=skill)
        if self.instance is not None:
            duplicates = duplicates.exclude(pk=self.instance.pk)
        if duplicates.exists():
            raise serializers.ValidationError({'skill': ['This skill is already in the job role\'s profile.']})
        return attrs

class EmployeeSkillRatingSerializer(TenantScopedSerializer):
    class Meta:
        model = EmployeeSkillRating
        fields = '__all__'
        # Ratings always belong to whoever records them; see EmployeeSkillRatingViewSet.
        read_only_fields = ('user',)

class TrainingCalendarSerializer(TenantScopedSerializer):
    class Meta:
        model = TrainingCalendar
        fields = '__all__'


class OrgUnitSerializer(TenantScopedSerializer):
    class Meta:
        model = OrgUnit
        fields = '__all__'


class TenantUniqueMixin:
    """Reports a clash on one of the model's per-tenant unique fields as a field error rather than a server error."""
    unique_per_tenant = ()

    def validate(self, attrs):
        attrs = super().validate(attrs)
        request = self.context.get('request')
        tenant_id = getattr(getattr(request, 'user', None), 'tenant_id', None)
        for name in self.unique_per_tenant:
            value = attrs.get(name)
            if not value:
                continue
            clash = self.Meta.model.objects.filter(tenant_id=tenant_id, **{f'{name}__iexact': value})
            if self.instance is not None:
                clash = clash.exclude(pk=self.instance.pk)
            if clash.exists():
                raise serializers.ValidationError({name: [f'"{value}" is already used.']})
        return attrs


class GradeSerializer(TenantUniqueMixin, TenantScopedSerializer):
    unique_per_tenant = ('code',)
    staff_count = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model = Grade
        fields = '__all__'
        validators = []


class JobFamilySerializer(TenantUniqueMixin, TenantScopedSerializer):
    unique_per_tenant = ('name',)
    staff_count = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model = JobFamily
        fields = '__all__'
        validators = []


class CompetencyFrameworkSerializer(TenantUniqueMixin, TenantScopedSerializer):
    unique_per_tenant = ('name',)
    skill_count = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model = CompetencyFramework
        fields = '__all__'
        validators = []


class ImportRunSerializer(serializers.ModelSerializer):
    created_by_name = serializers.SerializerMethodField()

    class Meta:
        model = ImportRun
        fields = ('id', 'kind', 'file_name', 'counts', 'errors', 'created_by', 'created_by_name', 'created_at')
        read_only_fields = fields

    def get_created_by_name(self, run):
        return (run.created_by.get_full_name() or run.created_by.username) if run.created_by else None

class UserSerializer(TenantScopedSerializer):
    password = serializers.CharField(write_only=True, required=False, style={'input_type': 'password'})

    class Meta:
        model = get_user_model()
        fields = ('id', 'username', 'email', 'first_name', 'last_name', 'is_staff', 'is_superuser', 'is_active', 'tenant', 'role', 'job_role',
                  'staff_number', 'supervisor', 'grade', 'job_family', 'employment_terms', 'date_of_appointment', 'gender', 'disability', 'extra',
                  'date_joined', 'last_login', 'password')
        read_only_fields = ('id', 'is_staff', 'is_superuser', 'date_joined', 'last_login')
        validators = []

    def validate_password(self, value):
        run_password_validators(value, self.instance)
        return value

    def validate(self, attrs):
        attrs = super().validate(attrs)
        number = attrs.get('staff_number')
        if number:
            request = self.context.get('request')
            tenant_id = self.instance.tenant_id if self.instance else getattr(getattr(request, 'user', None), 'tenant_id', None)
            clash = get_user_model().objects.filter(tenant_id=tenant_id, staff_number__iexact=number)
            if self.instance is not None:
                clash = clash.exclude(pk=self.instance.pk)
            if clash.exists():
                raise serializers.ValidationError({'staff_number': [f'{number} already belongs to someone else.']})
        supervisor = attrs.get('supervisor')
        if supervisor is not None and self.instance is not None and supervisor.pk == self.instance.pk:
            raise serializers.ValidationError({'supervisor': ["Someone can't supervise themselves."]})
        return attrs

    def create(self, validated_data):
        user = get_user_model().objects.create_user(**validated_data)
        return user

    def update(self, instance, validated_data):
        password = validated_data.pop('password', None)
        user = super().update(instance, validated_data)
        if password:
            user.set_password(password)
            user.save()
        return user

# Tenant Serializer
class TenantSerializer(serializers.ModelSerializer):
    # Super admins can name the organisation's first admin when creating it.
    admin_email = serializers.EmailField(write_only=True, required=False)
    # Filled in by TenantViewSet's annotated queryset; absent right after a create.
    user_count = serializers.IntegerField(read_only=True, default=0)
    org_unit_count = serializers.IntegerField(read_only=True, default=0)
    job_role_count = serializers.IntegerField(read_only=True, default=0)
    skill_count = serializers.IntegerField(read_only=True, default=0)
    pending_invitation_count = serializers.IntegerField(read_only=True, default=0)
    # A configuration pack to load into a new organisation (its grades, job families and wording).
    pack = serializers.ChoiceField(choices=PACK_CHOICES, write_only=True, required=False, allow_blank=True)
    # The organisation's wording for every generic term, its own choices over the defaults.
    terms = serializers.SerializerMethodField()

    class Meta:
        model = Tenant
        fields = ('id', 'name', 'industry', 'created_at', 'admin_email', 'pack', 'terminology', 'terms',
                  'user_count', 'org_unit_count', 'job_role_count', 'skill_count', 'pending_invitation_count')

    def get_terms(self, tenant):
        return terms_for(tenant)

    def validate_terminology(self, value):
        if not isinstance(value, dict) or not all(isinstance(k, str) and isinstance(v, str) for k, v in value.items()):
            raise serializers.ValidationError('Give the wording as {"term": "word"}.')
        return {k: v.strip() for k, v in value.items() if v.strip()}

    def create(self, validated_data):
        pack = validated_data.pop('pack', '')
        tenant = super().create(validated_data)
        if pack:
            apply_pack(tenant, pack)
        return tenant

    def update(self, instance, validated_data):
        validated_data.pop('admin_email', None)
        pack = validated_data.pop('pack', '')
        tenant = super().update(instance, validated_data)
        if pack:
            apply_pack(tenant, pack)
        return tenant


class InvitationSerializer(serializers.ModelSerializer):
    status = serializers.SerializerMethodField()
    accept_url = serializers.SerializerMethodField()

    class Meta:
        model = Invitation
        fields = ('id', 'tenant', 'email', 'role', 'invited_by', 'created_at', 'expires_at', 'accepted_at', 'status', 'accept_url')
        read_only_fields = ('id', 'invited_by', 'created_at', 'expires_at', 'accepted_at')

    def get_fields(self):
        fields = super().get_fields()
        request = self.context.get('request')
        # Only super admins choose the tenant; tenant admins always invite into their own.
        if not (request and request.user.is_superuser):
            fields['tenant'] = serializers.PrimaryKeyRelatedField(read_only=True)
        return fields

    def validate_email(self, value):
        if get_user_model().objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError('A user with this email already exists.')
        return value

    def get_status(self, obj):
        if obj.accepted_at:
            return 'accepted'
        return 'pending' if obj.is_pending else 'expired'

    def get_accept_url(self, obj):
        return accept_url(obj) if obj.is_pending else None


class AcceptInvitationSerializer(serializers.Serializer):
    username = serializers.CharField(max_length=150)
    password = serializers.CharField(write_only=True, style={'input_type': 'password'})
    first_name = serializers.CharField(max_length=150, required=False, allow_blank=True)
    last_name = serializers.CharField(max_length=150, required=False, allow_blank=True)

    def validate_username(self, value):
        if get_user_model().objects.filter(username__iexact=value).exists():
            raise serializers.ValidationError('This username is taken.')
        return value

    def validate(self, attrs):
        user = get_user_model()(username=attrs['username'], first_name=attrs.get('first_name', ''), last_name=attrs.get('last_name', ''))
        try:
            run_password_validators(attrs["password"], user)
        except DjangoValidationError as exc:
            raise serializers.ValidationError({'password': list(exc.messages)})
        return attrs

# Questionnaire Serializer
class QuestionnaireSerializer(TenantScopedSerializer):
    class Meta:
        model = Questionnaire
        fields = '__all__'

# Question Serializer
class QuestionSerializer(TenantScopedSerializer):
    class Meta:
        model = Question
        fields = '__all__'

# QuestionChoice Serializer
class QuestionChoiceSerializer(TenantScopedSerializer):
    class Meta:
        model = QuestionChoice
        fields = '__all__'

# QuestionResponse Serializer
class QuestionResponseSerializer(TenantScopedSerializer):
    class Meta:
        model = QuestionResponse
        fields = '__all__'
        read_only_fields = ('user',)

    def validate(self, attrs):
        question = attrs.get('question', getattr(self.instance, 'question', None))
        rating = attrs.get('response_rating', getattr(self.instance, 'response_rating', None))
        if question is not None and question.question_type == 'rating' and rating is None:
            raise serializers.ValidationError({'response_rating': ['Pick a level from 1 to 5.']})
        if rating is not None and not 1 <= rating <= 5:
            raise serializers.ValidationError({'response_rating': ['Ratings run from 1 to 5.']})
        return attrs


# Training plan

class TrainingPlanSerializer(TenantScopedSerializer):
    summary = serializers.SerializerMethodField()

    class Meta:
        model = TrainingPlan
        fields = '__all__'
        read_only_fields = ('created_by', 'created_at', 'approved_by', 'approved_at')

    def get_summary(self, plan):
        programmes = [training_plan.programme_figures(p) for p in plan.programmes.all()]
        total = round(sum(p['total_cost'] for p in programmes), 2)
        budget = training_plan.money(plan.budget)
        return {
            'programmes': len(programmes),
            'participants': sum(p['participants'] for p in programmes),
            'total_cost': total,
            'budget': budget,
            'balance': None if budget is None else round(budget - total, 2),
        }

    def validate_period(self, value):
        if not PERIOD_PATTERN.match(value):
            raise serializers.ValidationError('Use a financial year such as 2026/27.')
        start, end = int(value[:4]), int(value[5:])
        if (start + 1) % 100 != end:
            raise serializers.ValidationError('The second year must follow the first, as in 2026/27.')
        request = self.context.get('request')
        tenant_id = self.instance.tenant_id if self.instance else getattr(request.user, 'tenant_id', None)
        duplicates = TrainingPlan.objects.filter(tenant_id=tenant_id, period=value)
        if self.instance is not None:
            duplicates = duplicates.exclude(pk=self.instance.pk)
        if duplicates.exists():
            raise serializers.ValidationError('There is already a training plan for this financial year.')
        return value


class TrainingProgrammeSerializer(TenantScopedSerializer):
    participants = serializers.SerializerMethodField()
    cost_per_participant = serializers.SerializerMethodField()
    total_cost = serializers.SerializerMethodField()
    skill_name = serializers.CharField(source='skill.name', read_only=True, default=None)
    plan_period = serializers.CharField(source='plan.period', read_only=True)

    class Meta:
        model = TrainingProgramme
        fields = '__all__'

    def get_participants(self, programme):
        return training_plan.programme_figures(programme)['participants']

    def get_cost_per_participant(self, programme):
        return training_plan.money(programme.cost_per_participant)

    def get_total_cost(self, programme):
        return training_plan.programme_figures(programme)['total_cost']

    def validate(self, attrs):
        start = attrs.get('start_date', getattr(self.instance, 'start_date', None))
        end = attrs.get('end_date', getattr(self.instance, 'end_date', None))
        if start and end and end < start:
            raise serializers.ValidationError({'end_date': ['The course has to end on or after its start date.']})
        if self.instance is not None and 'plan' in attrs and attrs['plan'] != self.instance.plan:
            raise serializers.ValidationError({'plan': ['A programme can\'t move to another plan.']})
        return attrs


class TrainingEvaluationSerializer(serializers.ModelSerializer):
    PARTICIPANT_FIELDS = ('reaction_rating', 'relevance_rating', 'participant_comments')
    SUPERVISOR_FIELDS = ('pre_test_score', 'post_test_score', 'post_training_level', 'supervisor_comments')

    supervisor_name = serializers.SerializerMethodField()

    class Meta:
        model = TrainingEvaluation
        fields = ('id', 'nomination', 'reaction_rating', 'relevance_rating', 'participant_comments', 'participant_submitted_at',
                  'pre_test_score', 'post_test_score', 'post_training_level', 'supervisor_comments', 'supervisor', 'supervisor_name',
                  'supervisor_submitted_at')
        read_only_fields = ('id', 'nomination', 'participant_submitted_at', 'supervisor', 'supervisor_submitted_at')

    def get_supervisor_name(self, evaluation):
        return (evaluation.supervisor.get_full_name() or evaluation.supervisor.username) if evaluation.supervisor else None


class TrainingNominationSerializer(TenantScopedSerializer):
    officer = serializers.SerializerMethodField()
    priority = serializers.SerializerMethodField()
    programme_detail = serializers.SerializerMethodField()
    evaluation = TrainingEvaluationSerializer(read_only=True)

    class Meta:
        model = TrainingNomination
        fields = '__all__'
        read_only_fields = ('source', 'required_level', 'current_level', 'gap', 'priority_score', 'nominated_by', 'created_at')

    def get_priority(self, nomination):
        return priority_label(nomination.priority_score) if nomination.gap is not None else None

    def get_officer(self, nomination):
        return training_plan._person(nomination.user)

    def get_programme_detail(self, nomination):
        p = nomination.programme
        return {
            'id': p.pk, 'title': p.title, 'plan': p.plan_id, 'period': p.plan.period, 'quarter': p.quarter,
            'start_date': p.start_date, 'end_date': p.end_date, 'venue': p.venue, 'provider': p.provider,
            'delivery_mode': p.delivery_mode, 'duration_days': p.duration_days,
            'skill': {'id': p.skill.pk, 'name': p.skill.name} if p.skill else None,
        }

    def validate(self, attrs):
        programme = attrs.get('programme', getattr(self.instance, 'programme', None))
        user = attrs.get('user', getattr(self.instance, 'user', None))
        if self.instance is not None and (programme != self.instance.programme or user != self.instance.user):
            raise serializers.ValidationError('Withdraw this nomination and nominate again instead of moving it.')
        if self.instance is None and TrainingNomination.objects.filter(programme=programme, user=user).exists():
            raise serializers.ValidationError({'user': ['This officer is already nominated to this programme.']})
        status = attrs.get('status', getattr(self.instance, 'status', 'proposed'))
        attendance = attrs.get('attendance', getattr(self.instance, 'attendance', 'not_recorded'))
        if attendance != 'not_recorded' and status != 'approved':
            raise serializers.ValidationError({'attendance': ['Attendance can only be recorded for approved nominations.']})
        days = attrs.get('days_attended', getattr(self.instance, 'days_attended', None))
        if days is not None and programme is not None and days > programme.duration_days:
            raise serializers.ValidationError({'days_attended': [f'The course only runs for {programme.duration_days} days.']})
        return attrs
