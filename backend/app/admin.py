from django.contrib import admin
from .models import Tenant, User, JobRole, Skill, JobRoleSkill, EmployeeSkillRating, TrainingCalendar, OrgUnit, Questionnaire, Question, QuestionResponse, QuestionChoice

# Register your models here.
admin.site.register(Tenant)
admin.site.register(User)
admin.site.register(JobRole)
admin.site.register(Skill)
admin.site.register(JobRoleSkill)
admin.site.register(EmployeeSkillRating)
admin.site.register(TrainingCalendar)
admin.site.register(OrgUnit)
admin.site.register(Questionnaire)
admin.site.register(Question)
admin.site.register(QuestionResponse)
admin.site.register(QuestionChoice)
