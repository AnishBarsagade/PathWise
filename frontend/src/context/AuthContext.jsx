import React, { createContext, useContext, useState, useEffect } from "react";

const AuthContext = createContext(null);

const TOKEN_KEY = "pathwise_token";
const USER_KEY = "pathwise_user";

function isTokenExpired(t) {
  if (!t) return true;
  try {
    const parts = t.split(".");
    if (parts.length !== 3) return true;
    const payload = JSON.parse(atob(parts[1]));
    if (!payload.exp) return false;
    return Date.now() >= payload.exp * 1000;
  } catch {
    return true;
  }
}

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(() => {
    const storedToken = localStorage.getItem(TOKEN_KEY);
    if (!storedToken || isTokenExpired(storedToken)) {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
      return null;
    }
    return storedToken;
  });

  const [user, setUser] = useState(() => {
    try {
      const storedToken = localStorage.getItem(TOKEN_KEY);
      if (!storedToken || isTokenExpired(storedToken)) {
        return null;
      }
      const stored = localStorage.getItem(USER_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    const onAuthExpired = () => {
      setToken(null);
      setUser(null);
    };
    window.addEventListener("pathwise_auth_expired", onAuthExpired);
    return () => window.removeEventListener("pathwise_auth_expired", onAuthExpired);
  }, []);

  const login = (newToken, userData) => {
    localStorage.setItem(TOKEN_KEY, newToken);
    localStorage.setItem(USER_KEY, JSON.stringify(userData));
    setToken(newToken);
    setUser(userData);
  };

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setToken(null);
    setUser(null);
  };

  const isAuthenticated = !!token;

  return (
    <AuthContext.Provider value={{ token, user, isAuthenticated, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

export default AuthContext;
