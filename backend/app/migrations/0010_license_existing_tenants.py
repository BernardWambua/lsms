from datetime import date

from django.db import migrations

# Kept here rather than imported, so the migration doesn't change if licensing.py does.
BANDS = [('small', 300), ('medium', 1500), ('large', 5000)]


def license_existing_tenants(apps, schema_editor):
    """Organisations created before licensing get a Standard licence for the current financial year, in the band their staff fit."""
    Tenant = apps.get_model('app', 'Tenant')
    License = apps.get_model('app', 'License')
    LicenseEvent = apps.get_model('app', 'LicenseEvent')
    User = apps.get_model('app', 'User')
    today = date.today()
    start_year = today.year if today.month >= 7 else today.year - 1
    for tenant in Tenant.objects.filter(license__isnull=True):
        staff = User.objects.filter(tenant=tenant, is_active=True).count()
        band = next((name for name, limit in BANDS if staff <= limit), 'unlimited')
        license = License.objects.create(
            tenant=tenant, plan='standard', band=band,
            starts_on=date(start_year, 7, 1), ends_on=date(start_year + 1, 6, 30),
        )
        LicenseEvent.objects.create(license=license, summary='Standard licence issued for an organisation that existed before licensing.')


class Migration(migrations.Migration):

    dependencies = [
        ('app', '0009_licensing'),
    ]

    operations = [
        migrations.RunPython(license_existing_tenants, migrations.RunPython.noop),
    ]
