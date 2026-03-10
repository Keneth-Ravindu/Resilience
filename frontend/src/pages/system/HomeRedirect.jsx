import { Navigate } from "react-router-dom";
import { useAuth } from "../../auth/useAuth";

export default function HomeRedirect() {
    const { token, role } = useAuth();

    if (!token) return <Navigate to="/login" replace />;
    if (role === "admin") return <Navigate to="/admin" replace />;
    if (role === "mentor") return <Navigate to="/mentor" replace />;
    return <Navigate to="/app" replace />;
}