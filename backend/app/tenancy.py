"""Helpers for keeping every query inside a single tenant."""

from .models import Tenant, Question, QuestionChoice, QuestionResponse

# Models that don't carry a tenant column directly, and the lookup that reaches it.
TENANT_LOOKUPS = {
    Tenant: 'id',
    Question: 'questionnaire__tenant',
    QuestionChoice: 'question__questionnaire__tenant',
    QuestionResponse: 'question__questionnaire__tenant',
}


def tenant_lookup(model):
    """Return the ORM lookup from ``model`` to its tenant, or None if it isn't tenant-owned."""
    if model in TENANT_LOOKUPS:
        return TENANT_LOOKUPS[model]
    if any(field.name == 'tenant' for field in model._meta.get_fields()):
        return 'tenant'
    return None


def scope_to_tenant(queryset, tenant_id):
    lookup = tenant_lookup(queryset.model)
    if lookup is None:
        return queryset
    return queryset.filter(**{lookup: tenant_id})
