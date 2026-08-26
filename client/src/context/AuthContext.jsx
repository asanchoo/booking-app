import React, { createContext, useContext, useState, useEffect } from 'react';
import { checkAuthStatus, loginAdmin, logoutAdmin } from '../api/bookingApi.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  // null = still checking, false = not authenticated, true = authenticated
  const [authenticated, setAuthenticated] = useState(null);
  const [role, setRole] = useState(null);       // 'admin' | 'client' | null
  const [userInfo, setUserInfo] = useState({}); // { phone, name } for clients

  useEffect(() => {
    verifyAuth();
  }, []);

  const verifyAuth = async () => {
    try {
      const data = await checkAuthStatus();
      setAuthenticated(Boolean(data.authenticated));
      setRole(data.role || null);
      setUserInfo({ phone: data.phone, name: data.name });
    } catch {
      setAuthenticated(false);
      setRole(null);
      setUserInfo({});
    }
  };

  // login now works for BOTH admin and client (unified endpoint)
  // Returns { role, ...} from the server
  const login = async (loginField, password) => {
    const data = await loginAdmin(loginField, password);
    setAuthenticated(true);
    setRole(data.role || null);
    setUserInfo({ phone: data.phone, name: data.name });
    return data; // caller can use data.role to redirect
  };

  const logout = async () => {
    await logoutAdmin();
    setAuthenticated(false);
    setRole(null);
    setUserInfo({});
  };

  return (
    <AuthContext.Provider value={{ authenticated, role, userInfo, login, logout, verifyAuth }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
