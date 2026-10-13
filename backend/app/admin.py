from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from django.utils.html import format_html

from .invitations import accept_url, send_invitation
from .models import Tenant, User, JobRole, Skill, JobRoleSkill, EmployeeSkillRating, TrainingCalendar, OrgUnit, Questionnaire, Question, QuestionResponse, QuestionChoice, Invitation


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
    list_display = ('username', 'email', 'tenant', 'role', 'is_superuser')
    list_filter = ('tenant', 'role', 'is_superuser')
    fieldsets = UserAdmin.fieldsets + (('Organisation', {'fields': ('tenant', 'role', 'job_role')}),)
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
