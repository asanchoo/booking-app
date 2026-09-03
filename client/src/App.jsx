import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Navbar from './components/Navbar.jsx';
import CustomerBookingPage from './pages/CustomerBookingPage.jsx';
import AdminPage from './pages/AdminPage.jsx';
import LoginPage from './pages/LoginPage.jsx';
import MyBookingsPage from './pages/MyBookingsPage.jsx';
import BarberDashboardPage from './pages/BarberDashboardPage.jsx';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import { RefreshCw } from 'lucide-react';
import AiBookingAssistant from './components/AiBookingAssistant.jsx';
import './index.css';

// Protected Route specifically for Admin
function AdminProtectedRoute({ children }) {
  const { authenticated, role } = useAuth();

  if (authenticated === null) {
    return (
      <div className="page-container center-content" style={{ minHeight: '80vh' }}>
        <div className="loading-state">
          <RefreshCw className="spinner" size={24} />
          <span>Проверка прав доступа...</span>
        </div>
      </div>
    );
  }

  if (!authenticated || role !== 'admin') {
    return <Navigate to="/login" replace />;
  }

  return children;
}

// Protected Route specifically for Client
function ClientProtectedRoute({ children }) {
  const { authenticated, role } = useAuth();

  if (authenticated === null) {
    return (
      <div className="page-container center-content" style={{ minHeight: '80vh' }}>
        <div className="loading-state">
          <RefreshCw className="spinner" size={24} />
          <span>Загрузка профиля...</span>
        </div>
      </div>
    );
  }

  if (!authenticated || role !== 'client') {
    return <Navigate to="/login" replace />;
  }

  return children;
}

function BarberProtectedRoute({ children }) {
  const { authenticated, role } = useAuth();
  if (authenticated === null) return null;
  if (!authenticated || role !== 'barber') return <Navigate to="/login" replace />;
  return children;
}

function RoleAwareBookingRoute() {
  const { authenticated, role } = useAuth();
  if (authenticated === null) return null;
  if (authenticated && role === 'admin') return <Navigate to="/admin" replace />;
  if (authenticated && role === 'barber') return <Navigate to="/barber" replace />;
  return <CustomerBookingPage />;
}

function LoginRoute() {
  const { authenticated, role } = useAuth();
  if (authenticated === null) return null;
  if (!authenticated) return <LoginPage />;
  if (role === 'admin') return <Navigate to="/admin" replace />;
  if (role === 'barber') return <Navigate to="/barber" replace />;
  return <Navigate to="/my-account" replace />;
}

function PublicAiAssistant() {
  const { pathname } = useLocation();
  const { authenticated, role } = useAuth();
  if (authenticated === null || pathname !== '/' || (authenticated && ['admin', 'barber'].includes(role))) return null;
  return <AiBookingAssistant />;
}

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <Navbar />
        <main>
          <Routes>
            <Route path="/" element={<RoleAwareBookingRoute />} />
            
            {/* Unified Login / Register / Password Reset page */}
            <Route path="/login" element={<LoginRoute />} />
            <Route path="/my-account/login" element={<Navigate to="/login" replace />} />
            
            {/* Protected Client Dashboard */}
            <Route
              path="/my-account"
              element={
                <ClientProtectedRoute>
                  <MyBookingsPage />
                </ClientProtectedRoute>
              }
            />

            {/* Protected Admin Dashboard */}
            <Route
              path="/admin"
              element={
                <AdminProtectedRoute>
                  <AdminPage />
                </AdminProtectedRoute>
              }
            />
            <Route
              path="/barber"
              element={<BarberProtectedRoute><BarberDashboardPage /></BarberProtectedRoute>}
            />

            {/* Catch-all fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
        <PublicAiAssistant />
      </Router>
    </AuthProvider>
  );
}
