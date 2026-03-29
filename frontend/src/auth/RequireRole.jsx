import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "./useAuth";

export default function RequireRole({ allow }) {
    const { role } = useAuth();

    const effectiveRole = role || localStorage.getItem("role");

    if (!effectiveRole) {
        return <Navigate to="/login" replace />;
    }

    if (!allow.includes(effectiveRole)) {
        return <Navigate to="/not-authorized" replace />;
    }

    return <Outlet />;
}