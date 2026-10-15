import { useMemo } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { Box, CircularProgress, Container, CssBaseline } from "@mui/material";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import Navbar from "./components/Navbar";
import { AuthProvider, useAuth } from "./components/auth/authContext";
import RequireRole from "./components/auth/RequireRole";
import HomePage from "./components/HomePage";
import LandingPage from "./components/LandingPage";
import AcceptInvite from "./components/auth/AcceptInvite";
import Login from "./components/auth/Login";
import SuperAdminDashboard from "./components/superadmin/SuperAdminDashboard";
import TenantDetail from "./components/superadmin/TenantDetail";
import AdminDashboard from "./components/admin/AdminDashboard";
import PeoplePage from "./components/admin/PeoplePage";
import OrgStructurePage from "./components/admin/OrgStructurePage";
import ResourcePage from "./components/common/ResourcePage";
import RoleProfilePage from "./components/skills/RoleProfilePage";
import QuestionnairePage from "./components/questionnaires/QuestionnairePage";
import AnswerQuestionnaire from "./components/questionnaires/AnswerQuestionnaire";
import MySkillsPage from "./components/ratings/MySkillsPage";
import TeamRatingsPage from "./components/ratings/TeamRatingsPage";
import PersonRatingsPage from "./components/ratings/PersonRatingsPage";
import TNAReportPage from "./components/reports/TNAReportPage";
import TrainingPlansPage from "./components/training/TrainingPlansPage";
import TrainingPlanPage from "./components/training/TrainingPlanPage";
import ProgrammePage from "./components/training/ProgrammePage";
import MyTrainingPage from "./components/training/MyTrainingPage";
import ImportPage from "./components/imports/ImportPage";
import ClassificationPage from "./components/admin/ClassificationPage";
import { jobRoles, ORG_UNITS, QUESTIONNAIRES, skills } from "./components/structure/resources";
import { useTerms } from "./utils/terms";

const TENANT_ROLES = ['admin', 'manager', 'employee'];
const REVIEWERS = ['admin', 'manager'];

const theme = createTheme({
  palette: {
    mode: 'light',
    background: { default: '#f5f6fa' },
  },
});

// Each role lands somewhere different.
function Home() {
  const { user, role, loading } = useAuth();
  if (loading) return <Box textAlign="center" mt={8}><CircularProgress /></Box>;
  if (!user) return <HomePage />;
  if (role === 'superadmin') return <SuperAdminDashboard />;
  if (role === 'admin') return <AdminDashboard />;
  return <LandingPage />;
}

// Org structure pages: everyone in the tenant can look, only admins can change.
// `resource` is a definition, or a function of the organisation's wording that returns one.
function StructurePage({ resource, rowLink }) {
  const { role } = useAuth();
  const terms = useTerms();
  // Memoised so the page doesn't see new field definitions, and reload, on every render.
  const definition = useMemo(() => (typeof resource === 'function' ? resource(terms) : resource), [resource, terms]);
  return (
    <RequireRole roles={TENANT_ROLES}>
      <ResourcePage {...definition} readOnly={role !== 'admin'} rowLink={rowLink} />
    </RequireRole>
  );
}

function tenantPage(element) {
  return <RequireRole roles={TENANT_ROLES}>{element}</RequireRole>;
}

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AuthProvider>
        <Router>
          <Navbar />
          <Container maxWidth="lg" sx={{ py: 4 }}>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/login" element={<Login />} />
              <Route path="/accept-invite/:token" element={<AcceptInvite />} />
              <Route path="/tenants/:id" element={<RequireRole roles={['superadmin']}><TenantDetail /></RequireRole>} />
              <Route path="/org-structure" element={<RequireRole roles={['admin']}><OrgStructurePage /></RequireRole>} />
              <Route path="/people" element={<RequireRole roles={['admin']}><PeoplePage /></RequireRole>} />
              <Route path="/imports" element={<RequireRole roles={['admin']}><ImportPage /></RequireRole>} />
              <Route path="/classification" element={<RequireRole roles={['admin']}><ClassificationPage /></RequireRole>} />
              <Route path="/org-units" element={<StructurePage resource={ORG_UNITS} />} />
              <Route path="/job-roles" element={<StructurePage resource={jobRoles} rowLink={(role) => `/job-roles/${role.id}`} />} />
              <Route path="/job-roles/:id" element={tenantPage(<RoleProfilePage />)} />
              <Route path="/skills" element={<StructurePage resource={skills} />} />
              <Route path="/questionnaires" element={<StructurePage resource={QUESTIONNAIRES} rowLink={(q) => `/questionnaires/${q.id}`} />} />
              <Route path="/questionnaires/:id" element={tenantPage(<QuestionnairePage />)} />
              <Route path="/questionnaires/:id/answer" element={tenantPage(<AnswerQuestionnaire />)} />
              <Route path="/my-skills" element={tenantPage(<MySkillsPage />)} />
              <Route path="/ratings" element={<RequireRole roles={REVIEWERS}><TeamRatingsPage /></RequireRole>} />
              <Route path="/ratings/:id" element={<RequireRole roles={REVIEWERS}><PersonRatingsPage /></RequireRole>} />
              <Route path="/reports/tna" element={<RequireRole roles={REVIEWERS}><TNAReportPage /></RequireRole>} />
              <Route path="/training-plans" element={<RequireRole roles={REVIEWERS}><TrainingPlansPage /></RequireRole>} />
              <Route path="/training-plans/:id" element={<RequireRole roles={REVIEWERS}><TrainingPlanPage /></RequireRole>} />
              <Route path="/training-programmes/:id" element={<RequireRole roles={REVIEWERS}><ProgrammePage /></RequireRole>} />
              <Route path="/my-training" element={tenantPage(<MyTrainingPage />)} />
            </Routes>
          </Container>
        </Router>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
