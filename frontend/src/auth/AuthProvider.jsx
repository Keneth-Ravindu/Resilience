import { createContext, useMemo, useState } from "react";

export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [token, setToken] = useState(localStorage.getItem("access_token"));
    const [role, setRole] = useState(localStorage.getItem("role") || "user");

    const login = ({ access_token, role }) => {
        localStorage.setItem("access_token", access_token);
        setToken(access_token);

        if (role) {
        localStorage.setItem("role", role);
        setRole(role);
        }
    };

    const logout = () => {
        localStorage.removeItem("access_token");
        localStorage.removeItem("role");
        setToken(null);
        setRole("user");
    };

    const value = useMemo(
        () => ({ token, role, login, logout, setRole }),
        [token, role]
    );

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}