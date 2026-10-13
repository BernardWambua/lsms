import secrets
import uuid
from datetime import timedelta

from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from django.utils import timezone
from django.contrib.auth.models import AbstractUser

# Proficiency and DIF scores all use the same 1 (low) to 5 (high) scale.
SCORE_VALIDATORS = [MinValueValidator(1), MaxValueValidator(5)]
PROFICIENCY_LEVELS = [
    (1, 'Awareness'),
    (2, 'Basic'),
    (3, 'Intermediate'),
    (4, 'Advanced'),
    (5, 'Expert'),
]

class Tenant(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255)
    industry = models.CharField(max_length=255, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    def __str__(self):
        return self.name

class User(AbstractUser):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    # Platform super admins sit outside any tenant; everyone else belongs to exactly one.
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, null=True, blank=True)
    ROLE_CHOICES = [
        ('admin', 'Admin'),
        ('manager', 'Manager'),
        ('employee', 'Employee'),
    ]
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='employee')
    # The post this person holds. Their department is the job role's org unit, and
    # the role's skill profile is what their gaps are measured against.
    job_role = models.ForeignKey('JobRole', null=True, blank=True, on_delete=models.SET_NULL, related_name='holders')

class OrgUnit(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE)
    name = models.CharField(max_length=255)
    parent = models.ForeignKey('self', null=True, blank=True, related_name='children', on_delete=models.CASCADE)

    def __str__(self):
        return self.name

class JobRole(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE)
    org_unit = models.ForeignKey(OrgUnit, null=True, blank=True, on_delete=models.SET_NULL, related_name='job_roles')
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    
    def __str__(self):
        return self.title

class Skill(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE)
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    SKILL_TYPE_CHOICES = [
        ('technical', 'Technical'),
        ('soft', 'Soft'),
    ]
    type = models.CharField(max_length=20, choices=SKILL_TYPE_CHOICES, default='technical')
    difficulty = models.IntegerField()
    usage_frequency = models.IntegerField()
    impact_if_missing = models.IntegerField()
    
    def __str__(self):
        return self.name

class JobRoleSkill(models.Model):
    """
    One skill in a job role's profile: the proficiency level the role requires,
    and how the skill scores on DIF (difficulty, importance, frequency) for this role.
    DIF scores left blank fall back to the skill's own scores.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE)
    job_role = models.ForeignKey(JobRole, on_delete=models.CASCADE)
    skill = models.ForeignKey(Skill, on_delete=models.CASCADE)
    required_level = models.PositiveSmallIntegerField(choices=PROFICIENCY_LEVELS, default=3, validators=SCORE_VALIDATORS)
    difficulty = models.PositiveSmallIntegerField(null=True, blank=True, validators=SCORE_VALIDATORS)
    importance = models.PositiveSmallIntegerField(null=True, blank=True, validators=SCORE_VALIDATORS)
    frequency = models.PositiveSmallIntegerField(null=True, blank=True, validators=SCORE_VALIDATORS)

    @property
    def dif(self):
        """The (difficulty, importance, frequency) scores in effect for this role."""
        return (
            self.difficulty if self.difficulty is not None else self.skill.difficulty,
            self.importance if self.importance is not None else self.skill.impact_if_missing,
            self.frequency if self.frequency is not None else self.skill.usage_frequency,
        )

    @property
    def importance_score(self):
        return sum(self.dif) / 3

    def __str__(self):
        return f"{self.job_role.title} - {self.skill.name} (Importance: {self.importance_score})"

class EmployeeSkillRating(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE)
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    skill = models.ForeignKey(Skill, on_delete=models.CASCADE)
    self_rating = models.IntegerField(validators=SCORE_VALIDATORS)
    manager_rating = models.IntegerField(null=True, blank=True, validators=SCORE_VALIDATORS)
    survey_date = models.DateField()

class TrainingCalendar(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE)
    skill = models.ForeignKey(Skill, on_delete=models.CASCADE)
    training_title = models.CharField(max_length=255)
    scheduled_date = models.DateField()
    FORMAT_CHOICES = [('online', 'Online'), ('onsite', 'Onsite'), ('webinar', 'Webinar')]
    format = models.CharField(max_length=20, choices=FORMAT_CHOICES)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)

class Questionnaire(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE)
    title = models.CharField(max_length=255)
    org_unit = models.ForeignKey(OrgUnit, on_delete=models.SET_NULL, null=True, blank=True, related_name='questionnaires')
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.title

class Question(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    questionnaire = models.ForeignKey(Questionnaire, on_delete=models.CASCADE, related_name='questions')
    text = models.CharField(max_length=512)
    skill = models.ForeignKey(Skill, on_delete=models.SET_NULL, null=True, blank=True)
    QUESTION_TYPE_CHOICES = [
        ('rating', 'Rating'),
        ('choice', 'Multiple Choice'),
        ('text', 'Text'),
        ('true_false', 'True/False'),
    ]
    question_type = models.CharField(max_length=20, choices=QUESTION_TYPE_CHOICES, default='rating')

    def __str__(self):
        return self.text

class QuestionResponse(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    question = models.ForeignKey(Question, on_delete=models.CASCADE)
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    response_text = models.TextField(blank=True, null=True)
    response_rating = models.IntegerField(blank=True, null=True)
    response_choice = models.CharField(max_length=255, blank=True, null=True)
    submitted_at = models.DateTimeField(auto_now_add=True)

class QuestionChoice(models.Model):
    question = models.ForeignKey(Question, on_delete=models.CASCADE, related_name='choices')
    text = models.CharField(max_length=255)


def generate_invite_token():
    return secrets.token_urlsafe(32)


def default_invite_expiry():
    return timezone.now() + timedelta(days=7)


class Invitation(models.Model):
    """A one-time link that lets someone join a tenant with a given role."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, related_name='invitations')
    email = models.EmailField()
    role = models.CharField(max_length=20, choices=User.ROLE_CHOICES, default='employee')
    token = models.CharField(max_length=64, unique=True, default=generate_invite_token, editable=False)
    invited_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='invitations_sent')
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField(default=default_invite_expiry)
    accepted_at = models.DateTimeField(null=True, blank=True)
    accepted_by = models.OneToOneField(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='invitation')

    def __str__(self):
        return f"{self.email} -> {self.tenant} ({self.role})"

    @property
    def is_pending(self):
        return self.accepted_at is None and self.expires_at > timezone.now()
