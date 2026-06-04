/* eslint-disable react-refresh/only-export-components */

import {
  createContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import { jwtDecode } from "jwt-decode";

export const AuthContext =
  createContext();

const isTokenValid = (token) => {
  if (!token) return false;
  try {
    const decoded = jwtDecode(token);
    return decoded.exp * 1000 > Date.now();
  } catch {
    return false;
  }
};

export const AuthProvider = ({
  children,
}) => {
  const [token, setToken] = useState(() => {
    const stored = localStorage.getItem("token") || "";
    if (stored && !isTokenValid(stored)) {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      return "";
    }
    return stored;
  });
  const [user, setUser] = useState(() => {
    try {
      const storedUser = localStorage.getItem("user");
      return storedUser ? JSON.parse(storedUser) : null;
    } catch {
      return null;
    }
  });

  const logout = useCallback(() => {
    setToken("");
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setUser(null);
  }, []);

  // Periodically check token validity (every 60s)
  useEffect(() => {
    const interval = setInterval(() => {
      const currentToken = localStorage.getItem("token");
      if (currentToken && !isTokenValid(currentToken)) {
        logout();
      }
    }, 60000);

    return () => clearInterval(interval);
  }, [logout]);

  const login = (data) => {
    setToken(data.token || "");
    localStorage.setItem(
      "token",
      data.token
    );

    if (data.user) {
      localStorage.setItem(
        "user",
        JSON.stringify(data.user)
      );
    }

    setUser(data.user);
  };

  const setAuthFromQuery = (token, user) => {
    setToken(token || "");
    localStorage.setItem("token", token);
    localStorage.setItem("user", JSON.stringify(user));
    setUser(user);
  };

  return (
    <AuthContext.Provider
      value={{
        token,
        isAuthenticated: Boolean(token) && isTokenValid(token),
        user,
        login,
        logout,
        setAuthFromQuery,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};