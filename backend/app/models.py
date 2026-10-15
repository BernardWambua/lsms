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
    # The organisation's own words for LSMS's generic terms, e.g. {"grade": "Job Group"}.
    # Keys the tenant hasn't set fall back to the defaults in packs.DEFAULT_TERMS.
    terminology = models.JSONField(default=dict, blank=True)
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

    # The staff record as the organisation's HR system holds it. Only what TNA
    # reporting needs: no national ID, date of birth or ethnicity.
    staff_number = models.CharField(max_length=50, blank=True)
    supervisor = models.ForeignKey('self', null=True, blank=True, on_delete=models.SET_NULL, related_name='supervisees')
    grade = models.ForeignKey('Grade', null=True, blank=True, on_delete=models.SET_NULL, related_name='staff')
    job_family = models.ForeignKey('JobFamily', null=True, blank=True, on_delete=models.SET_NULL, related_name='staff')
    TERMS_CHOICES = [
        ('permanent', 'Permanent and pensionable'),
        ('contract', 'Contract'),
        ('temporary', 'Temporary'),
        ('intern', 'Intern'),
    ]
    employment_terms = models.CharField(max_length=20, choices=TERMS_CHOICES, blank=True)
    date_of_appointment = models.DateField(null=True, blank=True)
    GENDER_CHOICES = [('female', 'Female'), ('male', 'Male'), ('other', 'Other')]
    gender = models.CharField(max_length=10, choices=GENDER_CHOICES, blank=True)
    disability = models.BooleanField(null=True, blank=True)
    # Other columns from the HR export the organisation chose to keep (station, county, ...).
    extra = models.JSONField(default=dict, blank=True)

    class Meta(AbstractUser.Meta):
        constraints = [
            models.UniqueConstraint(
                fields=['tenant', 'staff_number'], condition=~models.Q(staff_number=''), name='unique_staff_number_per_tenant',
            ),
        ]

    @property
    def staff_ref(self):
        """The number reports show for this person: their staff number, or their username until they have one."""
        return self.staff_number or self.username


class Grade(models.Model):
    """
    A salary grade or level (a Job Group in the Kenyan public service, a band in a
    company). ``rank`` orders grades from junior to senior; ``aliases`` are other
    codes that mean the same grade, so imports using another scheme still match.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE)
    code = models.CharField(max_length=20)
    name = models.CharField(max_length=100, blank=True)
    rank = models.PositiveSmallIntegerField(default=0)
    aliases = models.JSONField(default=list, blank=True)

    class Meta:
        ordering = ['rank', 'code']
        constraints = [models.UniqueConstraint(fields=['tenant', 'code'], name='unique_grade_code_per_tenant')]

    def __str__(self):
        return self.name or self.code


class JobFamily(models.Model):
    """An occupational group: a cadre or scheme of service in the public service, a job family in a company."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE)
    code = models.CharField(max_length=20, blank=True)
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True)

    class Meta:
        ordering = ['name']
        verbose_name_plural = 'job families'
        constraints = [models.UniqueConstraint(fields=['tenant', 'name'], name='unique_job_family_per_tenant')]

    def __str__(self):
        return self.name


class CompetencyFramework(models.Model):
    """A published set of competencies (e.g. a public service commission's framework) that skills come from."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE)
    name = models.CharField(max_length=255)
    issuer = models.CharField(max_length=255, blank=True)
    version = models.CharField(max_length=50, blank=True)
    description = models.TextField(blank=True)

    class Meta:
        ordering = ['name']
        constraints = [models.UniqueConstraint(fields=['tenant', 'name'], name='unique_framework_per_tenant')]

    def __str__(self):
        return self.name

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
    grade = models.ForeignKey(Grade, null=True, blank=True, on_delete=models.SET_NULL, related_name='job_roles')
    job_family = models.ForeignKey(JobFamily, null=True, blank=True, on_delete=models.SET_NULL, related_name='job_roles')
    
    def __str__(self):
        return self.title

class Skill(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE)
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    # The category the skill sits in; competency frameworks usually split into core,
    # functional/technical and leadership competencies.
    SKILL_TYPE_CHOICES = [
        ('core', 'Core'),
        ('functional', 'Functional'),
        ('technical', 'Technical'),
        ('leadership', 'Leadership'),
        ('soft', 'Soft'),
    ]
    type = models.CharField(max_length=20, choices=SKILL_TYPE_CHOICES, default='technical')
    framework = models.ForeignKey(CompetencyFramework, null=True, blank=True, on_delete=models.SET_NULL, related_name='skills')
    # The competency's code in its framework, so re-importing a framework updates rather than duplicates.
    code = models.CharField(max_length=50, blank=True)
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


# Training plan: the costed annual plan built from the TNA gaps, the officers
# nominated to each programme, their attendance and the training evaluation.

# Quarters of the Kenyan government financial year (July to June).
QUARTERS = [
    (1, 'Q1 (Jul-Sep)'),
    (2, 'Q2 (Oct-Dec)'),
    (3, 'Q3 (Jan-Mar)'),
    (4, 'Q4 (Apr-Jun)'),
]
PRIORITY_CHOICES = [('high', 'High'), ('medium', 'Medium'), ('low', 'Low')]
MONEY = {'max_digits': 14, 'decimal_places': 2}


class TrainingPlan(models.Model):
    """One institution's annual training plan for a financial year, costed in KES."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE)
    period = models.CharField(max_length=7, help_text='Financial year, e.g. 2026/27')
    title = models.CharField(max_length=255, blank=True)
    # The approved training budget the plan has to fit within.
    budget = models.DecimalField(null=True, blank=True, **MONEY)
    # Starting costs for programmes generated from the gaps; HR adjusts each programme afterwards.
    default_fee = models.DecimalField(default=0, **MONEY)
    default_allowance_per_day = models.DecimalField(default=0, **MONEY)
    default_duration_days = models.PositiveSmallIntegerField(default=5)
    STATUS_CHOICES = [('draft', 'Draft'), ('submitted', 'Submitted'), ('approved', 'Approved')]
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='draft')
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='training_plans_created')
    created_at = models.DateTimeField(auto_now_add=True)
    approved_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='training_plans_approved')
    approved_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=['tenant', 'period'], name='one_training_plan_per_period')]

    def __str__(self):
        return self.title or f'Training plan {self.period}'


class TrainingProgramme(models.Model):
    """
    One course in the plan. Each officer costs the fee plus the daily allowance for
    every day of the course; the fixed cost (facilitators, venue) is shared.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE)
    plan = models.ForeignKey(TrainingPlan, on_delete=models.CASCADE, related_name='programmes')
    skill = models.ForeignKey(Skill, null=True, blank=True, on_delete=models.SET_NULL, related_name='training_programmes')
    title = models.CharField(max_length=255)
    provider = models.CharField(max_length=255, blank=True)
    DELIVERY_CHOICES = [
        ('in_house', 'In-house'),
        ('local', 'External (local)'),
        ('foreign', 'External (foreign)'),
        ('online', 'Online'),
    ]
    delivery_mode = models.CharField(max_length=20, choices=DELIVERY_CHOICES, default='in_house')
    quarter = models.PositiveSmallIntegerField(choices=QUARTERS, default=1)
    start_date = models.DateField(null=True, blank=True)
    end_date = models.DateField(null=True, blank=True)
    venue = models.CharField(max_length=255, blank=True)
    duration_days = models.PositiveSmallIntegerField(default=5)
    fee = models.DecimalField(default=0, help_text='Course fee per participant (KES)', **MONEY)
    allowance_per_day = models.DecimalField(default=0, help_text='Subsistence allowance per participant per day (KES)', **MONEY)
    fixed_cost = models.DecimalField(default=0, help_text='Facilitation, venue and other shared costs (KES)', **MONEY)
    priority = models.CharField(max_length=10, choices=PRIORITY_CHOICES, default='medium')
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.title

    @property
    def cost_per_participant(self):
        return self.fee + self.allowance_per_day * self.duration_days


class TrainingNomination(models.Model):
    """An officer nominated to a programme, with the gap that put them there and whether they attended."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE)
    programme = models.ForeignKey(TrainingProgramme, on_delete=models.CASCADE, related_name='nominations')
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='training_nominations')
    STATUS_CHOICES = [
        ('proposed', 'Proposed'),
        ('approved', 'Approved'),
        ('declined', 'Declined'),
        ('withdrawn', 'Withdrawn'),
    ]
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='proposed')
    SOURCE_CHOICES = [('gap', 'Skill gap'), ('manual', 'Nominated')]
    source = models.CharField(max_length=10, choices=SOURCE_CHOICES, default='manual')
    # The gap engine's figures when the officer was nominated, so the plan keeps its evidence.
    required_level = models.PositiveSmallIntegerField(null=True, blank=True)
    current_level = models.PositiveSmallIntegerField(null=True, blank=True)
    gap = models.PositiveSmallIntegerField(null=True, blank=True)
    priority_score = models.FloatField(null=True, blank=True)
    ATTENDANCE_CHOICES = [
        ('not_recorded', 'Not recorded'),
        ('attended', 'Attended'),
        ('partial', 'Partly attended'),
        ('absent', 'Absent'),
    ]
    attendance = models.CharField(max_length=20, choices=ATTENDANCE_CHOICES, default='not_recorded')
    days_attended = models.PositiveSmallIntegerField(null=True, blank=True)
    nominated_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='training_nominations_made')
    created_at = models.DateTimeField(auto_now_add=True)

    # Nominations that still count towards the plan's participants and cost.
    ACTIVE = ('proposed', 'approved')

    class Meta:
        constraints = [models.UniqueConstraint(fields=['programme', 'user'], name='one_nomination_per_programme')]

    def __str__(self):
        return f'{self.user} -> {self.programme}'


class TrainingEvaluation(models.Model):
    """
    How a nomination's training went, on the Kirkpatrick levels: the participant's
    reaction (level 1), test scores before and after (level 2), and the supervisor's
    rating of the skill back on the job (level 3), which becomes their manager rating.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE)
    nomination = models.OneToOneField(TrainingNomination, on_delete=models.CASCADE, related_name='evaluation')
    reaction_rating = models.PositiveSmallIntegerField(null=True, blank=True, validators=SCORE_VALIDATORS)
    relevance_rating = models.PositiveSmallIntegerField(null=True, blank=True, validators=SCORE_VALIDATORS)
    participant_comments = models.TextField(blank=True)
    participant_submitted_at = models.DateTimeField(null=True, blank=True)
    pre_test_score = models.PositiveSmallIntegerField(null=True, blank=True, validators=[MaxValueValidator(100)])
    post_test_score = models.PositiveSmallIntegerField(null=True, blank=True, validators=[MaxValueValidator(100)])
    post_training_level = models.PositiveSmallIntegerField(null=True, blank=True, choices=PROFICIENCY_LEVELS, validators=SCORE_VALIDATORS)
    supervisor_comments = models.TextField(blank=True)
    supervisor = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='training_evaluations_given')
    supervisor_submitted_at = models.DateTimeField(null=True, blank=True)


class ImportRun(models.Model):
    """One upload of a staff or competency file: who ran it, what it changed, and the rows it couldn't take."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE)
    KIND_CHOICES = [('staff', 'Staff'), ('competencies', 'Competency framework')]
    kind = models.CharField(max_length=20, choices=KIND_CHOICES)
    file_name = models.CharField(max_length=255)
    counts = models.JSONField(default=dict)
    errors = models.JSONField(default=list)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='import_runs')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
