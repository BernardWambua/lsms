from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from .views import SkillViewSet, JobRoleViewSet, JobRoleSkillViewSet, EmployeeSkillRatingViewSet, TrainingCalendarViewSet, OrgUnitViewSet, TenantViewSet, QuestionnaireViewSet, QuestionViewSet, QuestionChoiceViewSet, QuestionResponseViewSet, UserViewSet

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

urlpatterns = [
    path('', include(router.urls)),
    path('token/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
]
