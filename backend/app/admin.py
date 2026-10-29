from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from django.utils.html import format_html

from . import licensing
from .invitations import accept_url, send_invitation
from .models import License, LicenseEvent, Grade, JobFamily, CompetencyFramework, ImportRun, Tenant, User, JobRole, Skill, JobRoleSkill, EmployeeSkillRating, TrainingCalendar, OrgUnit, Questionnaire, Question, QuestionResponse, QuestionChoice, Invitation, TrainingPlan, TrainingProgramme, TrainingNomination, TrainingEvaluation


class InvitationInline(admin.TabularInline):
    model = Invitation
    fk_name = 'tenant'
    fields = ('email', 'role', 'expires_at', 'accepted_at')
    readonly_fields = ('expires_at', 'accepted_at')
    extra = 1


@admin.register(Tenant)
class TenantAdmin(admin.ModelAdmin):
    """Super admins create organisations here and invite their first admin inline."""
    list_display = ('name', 'industry', 'created_at')
    inlines = [InvitationInline]

    def save_formset(self, request, form, formset, change):
        invitations = formset.save(commit=False)
        for invitation in invitations:
            is_new = invitation._state.adding
            if is_new:
                invitation.invited_by = request.user
            invitation.save()
            if is_new:
                send_invitation(invitation)
        for obj in formset.deleted_objects:
            obj.delete()


class LicenseEventInline(admin.TabularInline):
    model = LicenseEvent
    fields = ('created_at', 'summary', 'by')
    readonly_fields = fields
    extra = 0
    can_delete = False

    def has_add_permission(self, request, obj=None):
        return False


@admin.register(License)
class LicenseAdmin(admin.ModelAdmin):
    """
    Super admins issue and renew licences here when an LPO arrives. Every
    organisation gets a pilot when it is created; nothing is billed automatically.
    """
    list_display = ('tenant', 'plan', 'band', 'ends_on', 'status', 'staff', 'lpo_number', 'paid_on')
    list_filter = ('plan', 'band', 'suspended')
    search_fields = ('tenant__name', 'lpo_number', 'invoice_number')
    readonly_fields = ('tenant',)
    fieldsets = (
        (None, {'fields': ('tenant', 'plan', 'band')}),
        ('Term', {'fields': ('starts_on', 'ends_on', 'grace_days', 'suspended', 'suspended_reason')}),
        ('Procurement', {'fields': ('lpo_number', 'invoice_number', 'amount', 'paid_on', 'notes')}),
    )
    inlines = [LicenseEventInline]

    def has_add_permission(self, request):
        return False

    @admin.display(description='Status')
    def status(self, obj):
        return licensing.state(obj).replace('_', '-')

    @admin.display(description='Active staff')
    def staff(self, obj):
        limit = licensing.staff_limit(obj)
        count = licensing.staff_count(obj.tenant)
        return f'{count:,} of {limit:,}' if limit else f'{count:,}'

    def save_model(self, request, obj, form, change):
        super().save_model(request, obj, form, change)
        if form.changed_data:
            labels = ', '.join(str(form.fields[name].label).lower() for name in form.changed_data)
            LicenseEvent.objects.create(license=obj, by=request.user, summary=f'Changed {labels}. Now {obj}.'[:500])


@admin.register(Invitation)
class InvitationAdmin(admin.ModelAdmin):
    list_display = ('email', 'tenant', 'role', 'created_at', 'expires_at', 'accepted_at')
    list_filter = ('tenant', 'role')
    fields = ('tenant', 'email', 'role', 'expires_at', 'invited_by', 'accepted_at', 'accepted_by', 'link')
    readonly_fields = ('invited_by', 'accepted_at', 'accepted_by', 'link')

    @admin.display(description='Invitation link')
    def link(self, obj):
        if obj.pk and obj.is_pending:
            url = accept_url(obj)
            return format_html('<a href="{}">{}</a>', url, url)
        return '-'

    def save_model(self, request, obj, form, change):
        if not change:
            obj.invited_by = request.user
        super().save_model(request, obj, form, change)
        if not change:
            send_invitation(obj)


@admin.register(User)
class LSMSUserAdmin(UserAdmin):
    list_display = ('username', 'staff_number', 'email', 'tenant', 'role', 'is_superuser')
    list_filter = ('tenant', 'role', 'is_superuser')
    search_fields = UserAdmin.search_fields + ('staff_number',)
    fieldsets = UserAdmin.fieldsets + (
        ('Organisation', {'fields': ('tenant', 'role', 'job_role')}),
        ('Staff record', {'fields': ('staff_number', 'supervisor', 'grade', 'job_family', 'employment_terms',
                                     'date_of_appointment', 'gender', 'disability', 'extra')}),
    )
    add_fieldsets = UserAdmin.add_fieldsets + (('Organisation', {'fields': ('tenant', 'role', 'job_role')}),)


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
admin.site.register(TrainingPlan)
admin.site.register(TrainingProgramme)
admin.site.register(TrainingNomination)
admin.site.register(TrainingEvaluation)
admin.site.register(Grade)
admin.site.register(JobFamily)
admin.site.register(CompetencyFramework)
admin.site.register(ImportRun)
