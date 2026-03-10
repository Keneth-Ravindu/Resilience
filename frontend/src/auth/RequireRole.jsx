import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "./useAuth";

export default function RequireRole({ allow }) {
    const { role } = useAuth();

    if (!allow.includes(role)) {
        return <Navigate to="/not-authorized" replace />;
    }

    return <Outlet />;
}