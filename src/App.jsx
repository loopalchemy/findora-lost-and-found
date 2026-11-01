import { Link, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { Layout } from './components/Layout.jsx';
import { useApp } from './context/AppContext.jsx';
import HomePage from './pages/HomePage.jsx';
import BrowsePage from './pages/BrowsePage.jsx';
import ItemPage from './pages/ItemPage.jsx';
import ReportPage from './pages/ReportPage.jsx';
import AuthPage from './pages/AuthPage.jsx';
import HowItWorksPage from './pages/HowItWorksPage.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import MyReportsPage from './pages/MyReportsPage.jsx';
import MyClaimsPage from './pages/MyClaimsPage.jsx';
import AdminPage from './pages/AdminPage.jsx';
import AdminReportsPage from './pages/AdminReportsPage.jsx';
import AdminClaimsPage from './pages/AdminClaimsPage.jsx';
import AdminManagementPage from './pages/AdminManagementPage.jsx';
import StatisticsPage from './pages/StatisticsPage.jsx';
import { EmptyState } from './components/UI.jsx';

function Gate({ admin = false, children }) {
  const { currentUser, loading } = useApp();
  const location = useLocation();
  if (loading) return <section className="section container" aria-live="polite"><p className="muted">Checking your account…</p></section>;
  if (!currentUser) return <Navigate to="/signin" state={{ from: `${location.pathname}${location.search}` }} replace />;
  if (admin && currentUser.role !== 'admin') return <Navigate to="/dashboard" replace />;
  return children;
}

function NotFound() {
  return <section className="section container"><EmptyState title="That page isn’t here" text="The link may be old, or the report may no longer be available." action={<Link className="btn btn--primary" to="/browse">Browse current reports</Link>} /></section>;
}

export default function App() {
  return <Layout><Routes>
    <Route path="/" element={<HomePage />} />
    <Route path="/browse" element={<BrowsePage />} />
    <Route path="/items/:id" element={<ItemPage />} />
    <Route path="/report" element={<Gate><ReportPage /></Gate>} />
    <Route path="/signin" element={<AuthPage mode="signin" />} />
    <Route path="/register" element={<AuthPage mode="register" />} />
    <Route path="/how-it-works" element={<HowItWorksPage />} />
    <Route path="/dashboard" element={<Gate><DashboardPage /></Gate>} />
    <Route path="/my-reports" element={<Gate><MyReportsPage /></Gate>} />
    <Route path="/my-claims" element={<Gate><MyClaimsPage /></Gate>} />
    <Route path="/admin" element={<Gate admin><AdminPage /></Gate>} />
    <Route path="/admin/reports" element={<Gate admin><AdminReportsPage /></Gate>} />
    <Route path="/admin/claims" element={<Gate admin><AdminClaimsPage /></Gate>} />
    <Route path="/admin/management" element={<Gate admin><AdminManagementPage /></Gate>} />
    <Route path="/admin/statistics" element={<Gate admin><StatisticsPage /></Gate>} />
    <Route path="*" element={<NotFound />} />
  </Routes></Layout>;
}
