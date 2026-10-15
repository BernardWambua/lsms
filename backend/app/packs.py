"""
Configuration packs: a sector's grades, occupational groups and wording, loaded
into a tenant so LSMS's generic models speak that sector's language. The code
only knows grades, job families and staff numbers; a pack says that, for the
Kenyan public service, those are Job Groups, cadres and P/F numbers.
"""

from django.db import transaction

from .models import Grade, JobFamily

# LSMS's generic wording. A tenant's ``terminology`` overrides any of these.
DEFAULT_TERMS = {
    'organisation': 'Organisation',
    'org_unit': 'Department',
    'staff_number': 'Staff number',
    'grade': 'Grade',
    'grades': 'Grades',
    'job_family': 'Job family',
    'job_families': 'Job families',
    'competency_framework': 'Competency framework',
    'competency_frameworks': 'Competency frameworks',
}

# Job Groups run A to T; the letters I and O are not used.
KENYA_JOB_GROUPS = [letter for letter in 'ABCDEFGHJKLMNPQRST']

PACKS = {
    'kenya_public_service': {
        'label': 'Kenya public service',
        'industry': 'Public sector',
        'terms': {
            'organisation': 'MDA',
            'staff_number': 'P/F No.',
            'grade': 'Job Group',
            'grades': 'Job Groups',
            'job_family': 'Cadre',
            'job_families': 'Cadres',
        },
        'grades': [(code, f'Job Group {code}') for code in KENYA_JOB_GROUPS],
        'job_families': [
            'Accountants', 'Administrative Officers', 'Clerical Officers', 'Economists and Statisticians',
            'Human Resource Management Officers', 'ICT Officers', 'Legal Officers', 'Office Administrators',
            'Records Management Officers', 'Supply Chain Management Officers', 'Communication Officers',
            'Drivers', 'Support Staff',
        ],
    },
}

PACK_CHOICES = [(key, pack['label']) for key, pack in PACKS.items()]


def terms_for(tenant):
    """The words this tenant uses for LSMS's generic terms."""
    return {**DEFAULT_TERMS, **((tenant.terminology or {}) if tenant else {})}


@transaction.atomic
def apply_pack(tenant, key):
    """
    Load a pack's wording, grades and job families into ``tenant``. Safe to run
    again: existing grades and families are kept, missing ones are added.
    """
    pack = PACKS[key]
    tenant.terminology = {**pack['terms'], **(tenant.terminology or {})}
    if not tenant.industry:
        tenant.industry = pack['industry']
    tenant.save(update_fields=['terminology', 'industry'])
    for rank, (code, name) in enumerate(pack['grades'], start=1):
        Grade.objects.get_or_create(tenant=tenant, code=code, defaults={'name': name, 'rank': rank})
    for name in pack['job_families']:
        JobFamily.objects.get_or_create(tenant=tenant, name=name)
