import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Navbar from './components/Navbar.jsx';
import CustomerBookingPage from './pages/CustomerBookingPage.jsx';
import AdminPage from './pages/AdminPage.jsx';
import LoginPage from './pages/LoginPage.jsx';
import MyBookingsPage from './pages/MyBookingsPage.jsx';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import { RefreshCw } from 'lucide-react';
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

  if (!authenticated) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <Navbar />
        <main>
          <Routes>
            <Route path="/" element={<CustomerBookingPage />} />
            
            {/* Unified Login / Register / Password Reset page */}
            <Route path="/login" element={<LoginPage />} />
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

            {/* Catch-all fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </Router>
    </AuthProvider>
  );
}
