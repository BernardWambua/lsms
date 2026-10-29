"""
Per-organisation licences: what each plan and headcount band allows, whether
a licence still lets the organisation make changes, and the checks that keep
it within its staff limit.

An expired licence never locks an organisation out of its own data. After
``ends_on`` it keeps full access for ``grace_days``, then becomes read-only:
people can still sign in, view everything and download their reports.
"""

from datetime import date, timedelta

from django.contrib.auth import get_user_model
from rest_framework import permissions
from rest_framework.exceptions import PermissionDenied

PILOT_DAYS = 180

PLANS = {
    'pilot': {'label': 'Pilot', 'watermark': 'PILOT LICENCE - EVALUATION COPY'},
    'standard': {'label': 'Standard', 'watermark': ''},
    'enterprise': {'label': 'Enterprise', 'watermark': ''},
}

# The most active staff records each band allows; None means no limit.
STAFF_LIMITS = {'small': 300, 'medium': 1500, 'large': 5000, 'unlimited': None}

ACTIVE, GRACE, READ_ONLY, SUSPENDED = 'active', 'grace', 'read_only', 'suspended'
WRITABLE_STATES = (ACTIVE, GRACE)


def financial_year_bounds(today=None):
    """1 July to 30 June of the Kenyan government financial year that ``today`` falls in."""
    today = today or date.today()
    start_year = today.year if today.month >= 7 else today.year - 1
    return date(start_year, 7, 1), date(start_year + 1, 6, 30)


def issue_pilot(tenant, today=None, by=None):
    from .models import License, LicenseEvent
    today = today or date.today()
    license = License.objects.create(tenant=tenant, plan='pilot', starts_on=today, ends_on=today + timedelta(days=PILOT_DAYS))
    LicenseEvent.objects.create(license=license, by=by, summary=f'Pilot licence issued until {license.ends_on:%d %b %Y}.')
    return license


def license_for(tenant):
    """The tenant's licence, issuing a pilot if it has none (only possible for rows made outside Tenant.save)."""
    from .models import License
    # Read fresh rather than through tenant.license, which a long-lived Tenant object may hold stale.
    return License.objects.filter(tenant=tenant).first() or issue_pilot(tenant)


def grace_ends_on(license):
    return license.ends_on + timedelta(days=license.grace_days)


def state(license, today=None):
    today = today or date.today()
    if license.suspended:
        return SUSPENDED
    if today <= license.ends_on:
        return ACTIVE
    if today <= grace_ends_on(license):
        return GRACE
    return READ_ONLY


def staff_limit(license):
    return STAFF_LIMITS[license.band]


def staff_count(tenant):
    return get_user_model().objects.filter(tenant=tenant, is_active=True).count()


def watermark(tenant):
    """Text to stamp across reports for this tenant, or '' for a paid licence."""
    return PLANS[license_for(tenant).plan]['watermark']


def summary(tenant, today=None):
    """Everything the app shows about a licence: plan, term, state and staff used."""
    license = license_for(tenant)
    today = today or date.today()
    current = state(license, today)
    return {
        'plan': license.plan,
        'plan_label': PLANS[license.plan]['label'],
        'band': license.band,
        'band_label': license.get_band_display(),
        'staff_limit': staff_limit(license),
        'staff_count': staff_count(tenant),
        'starts_on': license.starts_on,
        'ends_on': license.ends_on,
        'grace_ends_on': grace_ends_on(license),
        'days_left': (license.ends_on - today).days,
        'state': current,
        'writable': current in WRITABLE_STATES,
        'suspended_reason': license.suspended_reason if license.suspended else '',
        'watermark': PLANS[license.plan]['watermark'],
        'lpo_number': license.lpo_number,
    }


class LicenseReadOnly(PermissionDenied):
    pass


class StaffLimitReached(PermissionDenied):
    pass


def read_only_message(license):
    if license.suspended:
        reason = f' ({license.suspended_reason})' if license.suspended_reason else ''
        return f"This organisation's licence is suspended{reason}, so LSMS is read-only. Contact your LSMS account manager."
    return (f"This organisation's licence expired on {license.ends_on:%d %b %Y}, so LSMS is read-only. "
            "Ask your administrator to renew it.")


def ensure_writable(tenant):
    license = license_for(tenant)
    if state(license) not in WRITABLE_STATES:
        raise LicenseReadOnly(read_only_message(license))


def ensure_room_for(tenant, adding=1):
    """Refuse to add ``adding`` more active staff if that would take the tenant past its band."""
    license = license_for(tenant)
    limit = staff_limit(license)
    if limit is not None and staff_count(tenant) + adding > limit:
        raise StaffLimitReached(staff_limit_message(license, limit))


def ensure_within_limit(tenant):
    """Refuse if the tenant already has more active staff than its band allows (for checks after a bulk change)."""
    license = license_for(tenant)
    limit = staff_limit(license)
    count = staff_count(tenant)
    if limit is not None and count > limit:
        raise StaffLimitReached(f'{staff_limit_message(license, limit)} This change would bring it to {count:,}.')


def staff_limit_message(license, limit):
    return (f"Your licence covers up to {limit:,} active staff ({license.get_band_display()}). "
            "Deactivate people who have left, or ask your LSMS account manager to move you to a larger band.")


class HasWritableLicense(permissions.BasePermission):
    """
    Reads are always allowed. Changes need a licence that is active or in its
    grace period. Super admins and users outside any tenant aren't affected.
    """

    def has_permission(self, request, view):
        user = request.user
        if request.method in permissions.SAFE_METHODS or not user or not user.is_authenticated:
            return True
        if user.is_superuser or user.tenant_id is None:
            return True
        license = license_for(user.tenant)
        if state(license) in WRITABLE_STATES:
            return True
        self.message = read_only_message(license)
        return False
