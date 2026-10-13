from rest_framework import serializers
from .models import Skill, JobRole, JobRoleSkill, EmployeeSkillRating, TrainingCalendar, OrgUnit, User, Tenant, Questionnaire, Question, QuestionResponse, QuestionChoice
from django.contrib.auth import get_user_model

class SkillSerializer(serializers.ModelSerializer):
    class Meta:
        model = Skill
        fields = '__all__'

class JobRoleSerializer(serializers.ModelSerializer):
    class Meta:
        model = JobRole
        fields = '__all__'

class JobRoleSkillSerializer(serializers.ModelSerializer):
    importance_score = serializers.FloatField(read_only=True)

    class Meta:
        model = JobRoleSkill
        fields = '__all__'

class EmployeeSkillRatingSerializer(serializers.ModelSerializer):
    class Meta:
        model = EmployeeSkillRating
        fields = '__all__'

class TrainingCalendarSerializer(serializers.ModelSerializer):
    class Meta:
        model = TrainingCalendar
        fields = '__all__'
        
        
class OrgUnitSerializer(serializers.ModelSerializer):
    class Meta:
        model = OrgUnit
        fields = '__all__'
        
class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = get_user_model()
        fields = ('id', 'username', 'email', 'first_name', 'last_name', 'is_staff', 'is_active', 'tenant', 'role')
        read_only_fields = ('id', 'is_staff', 'is_active')

    def create(self, validated_data):
        user = get_user_model().objects.create_user(**validated_data)
        return user

# Tenant Serializer
class TenantSerializer(serializers.ModelSerializer):
    class Meta:
        model = Tenant
        fields = '__all__'

# Questionnaire Serializer
class QuestionnaireSerializer(serializers.ModelSerializer):
    class Meta:
        model = Questionnaire
        fields = '__all__'

# Question Serializer
class QuestionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Question
        fields = '__all__'

# QuestionChoice Serializer
class QuestionChoiceSerializer(serializers.ModelSerializer):
    class Meta:
        model = QuestionChoice
        fields = '__all__'

# QuestionResponse Serializer
class QuestionResponseSerializer(serializers.ModelSerializer):
    class Meta:
        model = QuestionResponse
        fields = '__all__'
