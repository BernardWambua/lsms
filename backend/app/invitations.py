"""Creating, sending and accepting tenant invitations."""

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.mail import send_mail
from django.db import transaction
from django.utils import timezone

from .models import Invitation


def accept_url(invitation):
    return f"{settings.FRONTEND_URL.rstrip('/')}/accept-invite/{invitation.token}"


def send_invitation(invitation):
    inviter = (invitation.invited_by.get_full_name() or invitation.invited_by.username) if invitation.invited_by else 'An administrator'
    send_mail(
        subject=f"You're invited to join {invitation.tenant.name} on LSMS",
        message=(
            f"{inviter} has invited you to join {invitation.tenant.name} on LSMS as {invitation.get_role_display().lower()}.\n\n"
            f"Accept the invitation and set up your account here:\n{accept_url(invitation)}\n\n"
            f"This link expires on {invitation.expires_at:%d %b %Y}."
        ),
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[invitation.email],
    )


def create_invitation(tenant, email, role, invited_by=None):
    invitation = Invitation.objects.create(tenant=tenant, email=email, role=role, invited_by=invited_by)
    send_invitation(invitation)
    return invitation


class InvitationUnavailable(Exception):
    pass


def accept_invitation(token, username, password, first_name='', last_name=''):
    """Create the invited user. Raises InvitationUnavailable if the token is unknown, used or expired."""
    with transaction.atomic():
        invitation = Invitation.objects.select_for_update().select_related('tenant').filter(token=token).first()
        if invitation is None or not invitation.is_pending:
            raise InvitationUnavailable()

        User = get_user_model()
        # The first person into an organisation runs it, whatever the invite said.
        role = 'admin' if not User.objects.filter(tenant=invitation.tenant).exists() else invitation.role
        user = User.objects.create_user(
            username=username,
            password=password,
            email=invitation.email,
            first_name=first_name,
            last_name=last_name,
            tenant=invitation.tenant,
            role=role,
        )
        invitation.accepted_at = timezone.now()
        invitation.accepted_by = user
        invitation.save(update_fields=['accepted_at', 'accepted_by'])
    return user
