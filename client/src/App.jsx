import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Navbar from './components/Navbar.jsx';
import CustomerBookingPage from './pages/CustomerBookingPage.jsx';
import AdminPage from './pages/AdminPage.jsx';
import LoginPage from './pages/LoginPage.jsx';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import { RefreshCw } from 'lucide-react';
import './index.css';

function ProtectedRoute({ children }) {
  const { authenticated } = useAuth();

  if (authenticated === null) {
    return (
      <div className="page-container center-content">
        <div className="loading-state">
          <RefreshCw className="spinner" size={24} />
          <span>Проверка авторизации...</span>
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
            <Route path="/login" element={<LoginPage />} />
            <Route
              path="/admin"
              element={
                <ProtectedRoute>
                  <AdminPage />
                </ProtectedRoute>
              }
            />
          </Routes>
        </main>
      </Router>
    </AuthProvider>
  );
}
