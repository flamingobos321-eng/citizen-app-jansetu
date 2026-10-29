import { createContext, useContext, useEffect, useState } from "react";
import { api } from "./api";

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("jansetu_token");
    if (!token) {
      setLoading(false);
      return;
    }
    api
      .get("/auth/me")
      .then((r) => setUser(r.data))
      .catch(() => {
        localStorage.removeItem("jansetu_token");
      })
      .finally(() => setLoading(false));
  }, []);

  const loginWithToken = (token, userObj) => {
    localStorage.setItem("jansetu_token", token);
    setUser(userObj);
  };

  const logout = () => {
    localStorage.removeItem("jansetu_token");
    setUser(null);
  };

  return (
    <AuthCtx.Provider value={{ user, setUser, loginWithToken, logout, loading }}>
      {children}
    </AuthCtx.Provider>
  );
}

export const useAuth = () => useContext(AuthCtx);
