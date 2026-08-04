import React, { createContext, useContext, useState, useEffect } from 'react';
import { checkAuthStatus, loginAdmin, logoutAdmin } from '../api/bookingApi.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [authenticated, setAuthenticated] = useState(null); // null = checking, true = auth, false = not auth

  useEffect(() => {
    verifyAuth();
  }, []);

  const verifyAuth = async () => {
    try {
      const data = await checkAuthStatus();
      setAuthenticated(data.authenticated);
    } catch {
      setAuthenticated(false);
    }
  };

  const login = async (username, password) => {
    await loginAdmin(username, password);
    setAuthenticated(true);
  };

  const logout = async () => {
    await logoutAdmin();
    setAuthenticated(false);
  };

  return (
    <AuthContext.Provider value={{ authenticated, login, logout, verifyAuth }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
