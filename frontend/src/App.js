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
import { JOB_ROLES, ORG_UNITS, SKILLS } from "./components/structure/resources";

const TENANT_ROLES = ['admin', 'manager', 'employee'];

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
function StructurePage({ resource }) {
  const { role } = useAuth();
  return (
    <RequireRole roles={TENANT_ROLES}>
      <ResourcePage {...resource} readOnly={role !== 'admin'} />
    </RequireRole>
  );
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
              <Route path="/org-units" element={<StructurePage resource={ORG_UNITS} />} />
              <Route path="/job-roles" element={<StructurePage resource={JOB_ROLES} />} />
              <Route path="/skills" element={<StructurePage resource={SKILLS} />} />
            </Routes>
          </Container>
        </Router>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
