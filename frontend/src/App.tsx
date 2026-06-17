import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { DataProvider } from './context/DataContext';
import Layout from './components/Layout';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Register from './pages/Register';
import AICounselor from './pages/AICounselor';
import CollegeExplorer from './pages/CollegeExplorer';
import CollegeDetails from './pages/CollegeDetails';
import CollegeComparison from './pages/CollegeComparison';
import CollegeRecommendations from './pages/CollegeRecommendations';
import CutoffExplorer from './pages/CutoffExplorer';
import AdmissionPredictor from './pages/AdmissionPredictor';
import Shortlist from './pages/Shortlist';

// Redirects logged-in users away from auth pages
function GuestRoute() {
  const { user, loading } = useAuth();
  if (loading) return null;
  return user ? <Navigate to="/app/recommendations" replace /> : <Outlet />;
}

// Requires auth; redirects to /login if not logged in
function ProtectedRoute() {
  const { user, loading } = useAuth();
  if (loading) return null;
  return user ? <Outlet /> : <Navigate to="/login" replace />;
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<Landing />} />

          {/* Auth pages — only for guests */}
          <Route element={<GuestRoute />}>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
          </Route>

          {/* Protected app */}
          <Route element={<ProtectedRoute />}>
            <Route path="/app" element={<DataProvider><Layout /></DataProvider>}>
              <Route index element={<Navigate to="/app/recommendations" replace />} />
              <Route path="ai-counselor" element={<AICounselor />} />
              <Route path="colleges" element={<CollegeExplorer />} />
              <Route path="colleges/:id" element={<CollegeDetails />} />
              <Route path="compare" element={<CollegeComparison />} />
              <Route path="recommendations" element={<CollegeRecommendations />} />
              <Route path="cutoffs" element={<CutoffExplorer />} />
              <Route path="predictor" element={<AdmissionPredictor />} />
              <Route path="shortlist" element={<Shortlist />} />
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
