import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import OrgUnitsListing from "./components/OrgUnitsListing";
import Navbar from "./components/Navbar";
import { AuthProvider } from "./components/auth/authContext";
import HomePage from "./components/HomePage";
import LandingPage from "./components/LandingPage";
import Signup from "./components/auth/Signup";
import Login from "./components/auth/Login";

function App() {
  const isLoggedIn = !!sessionStorage.getItem('username');
  return (
    <AuthProvider>
      <Router>
        <div className="App">
          <header className="App-header">
            <Navbar />
          </header>
          <main>
            <Routes>
              <Route path="/" element={isLoggedIn ? <LandingPage /> : <HomePage />} />
              <Route path="/signup" element={<Signup />} />
              <Route path="/login" element={<Login />} />
              <Route path="/org-units" element={<OrgUnitsListing />} />
              {/* Add more routes as needed */}
            </Routes>
          </main>
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;
