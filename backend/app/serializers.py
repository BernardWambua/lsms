from rest_framework import serializers
from .models import Skill, JobRole, JobRoleSkill, EmployeeSkillRating, TrainingCalendar, OrgUnit, Tenant, Questionnaire, Question, QuestionResponse, QuestionChoice
from django.contrib.auth import get_user_model
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

    def get_fields(self):
        fields = super().get_fields()
        request = self.context.get('request')
        signing_up = self.instance is None and not (request and request.user.is_authenticated)
        if signing_up:
            # Self-service signup picks the tenant to join and must set a password.
            fields['tenant'] = serializers.PrimaryKeyRelatedField(queryset=Tenant.objects.all())
            fields['password'].required = True
        return fields

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
    class Meta:
        model = Tenant
        fields = '__all__'

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
