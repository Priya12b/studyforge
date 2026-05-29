/* eslint-disable react-refresh/only-export-components */

import {
  createContext,
  useState,
} from "react";

export const AuthContext =
  createContext();

export const AuthProvider = ({
  children,
}) => {
  const [token, setToken] = useState(() => localStorage.getItem("token") || "");
  const [user, setUser] = useState(() => {
    try {
      const storedUser = localStorage.getItem("user");
      return storedUser ? JSON.parse(storedUser) : null;
    } catch {
      return null;
    }
  });

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

  const logout = () => {
    setToken("");
    localStorage.removeItem("token");
    localStorage.removeItem("user");

    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        token,
        isAuthenticated: Boolean(token),
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