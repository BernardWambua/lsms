from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from .views import SkillViewSet, JobRoleViewSet, JobRoleSkillViewSet, EmployeeSkillRatingViewSet, TrainingCalendarViewSet, OrgUnitViewSet, TenantViewSet, QuestionnaireViewSet, QuestionViewSet, QuestionChoiceViewSet, QuestionResponseViewSet, UserViewSet, InvitationViewSet, AcceptInvitationView, OrgStructureView, MyGapsView, PersonGapsView, DepartmentGapsView, InstitutionGapsView

router = DefaultRouter()
router.register(r'skills', SkillViewSet)
router.register(r'job-roles', JobRoleViewSet)
router.register(r'job-role-skills', JobRoleSkillViewSet)
router.register(r'ratings', EmployeeSkillRatingViewSet)
router.register(r'training-calendar', TrainingCalendarViewSet)
router.register(r'org-units', OrgUnitViewSet)
router.register(r'tenants', TenantViewSet)
router.register(r'questionnaires', QuestionnaireViewSet)
router.register(r'questions', QuestionViewSet)
router.register(r'question-choices', QuestionChoiceViewSet)
router.register(r'question-responses', QuestionResponseViewSet)
router.register(r'users', UserViewSet)
router.register(r'invitations', InvitationViewSet)

urlpatterns = [
    path('gaps/me/', MyGapsView.as_view(), name='my_gaps'),
    path('gaps/people/<uuid:pk>/', PersonGapsView.as_view(), name='person_gaps'),
    path('gaps/departments/<uuid:pk>/', DepartmentGapsView.as_view(), name='department_gaps'),
    path('gaps/institution/', InstitutionGapsView.as_view(), name='institution_gaps'),
    path('org-structure/', OrgStructureView.as_view(), name='org_structure'),
    path('invitations/accept/<str:token>/', AcceptInvitationView.as_view(), name='accept_invitation'),
    path('', include(router.urls)),
    path('token/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
]
