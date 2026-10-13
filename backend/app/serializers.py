from rest_framework import serializers
from .models import Skill, JobRole, JobRoleSkill, EmployeeSkillRating, TrainingCalendar, OrgUnit, Tenant, Questionnaire, Question, QuestionResponse, QuestionChoice, Invitation
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password as run_password_validators
from django.core.exceptions import ValidationError as DjangoValidationError
from .invitations import accept_url
from .tenancy import scope_to_tenant


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

class EmployeeSkillRatingSerializer(TenantScopedSerializer):
    class Meta:
        model = EmployeeSkillRating
        fields = '__all__'

class TrainingCalendarSerializer(TenantScopedSerializer):
    class Meta:
        model = TrainingCalendar
        fields = '__all__'


class OrgUnitSerializer(TenantScopedSerializer):
    class Meta:
        model = OrgUnit
        fields = '__all__'

class UserSerializer(TenantScopedSerializer):
    password = serializers.CharField(write_only=True, required=False, style={'input_type': 'password'})

    class Meta:
        model = get_user_model()
        fields = ('id', 'username', 'email', 'first_name', 'last_name', 'is_staff', 'is_active', 'tenant', 'role', 'password')
        read_only_fields = ('id', 'is_staff', 'is_active')

    def validate_password(self, value):
        run_password_validators(value, self.instance)
        return value

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

    class Meta:
        model = Tenant
        fields = ('id', 'name', 'industry', 'created_at', 'admin_email')

    def update(self, instance, validated_data):
        validated_data.pop('admin_email', None)
        return super().update(instance, validated_data)


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
