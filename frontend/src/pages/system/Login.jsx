import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import api from "../../api/client";
import { useAuth } from "../../auth/useAuth";
import logo from "../../assets/logo.png";



export default function Login() {
    const { login } = useAuth();
    const nav = useNavigate();
    const loc = useLocation();

    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [err, setErr] = useState("");

    const submit = async (e) => {
        e.preventDefault();
        setErr("");

        try {
            const form = new URLSearchParams();
            form.append("username", username);
            form.append("password", password);

            const res = await api.post("/auth/login", form, {
                headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                },
            });

            login({
                access_token: res.data.access_token,
                role: res.data.role,
            });

            if (res.data.role === "mentor") {
                nav("/mentor", { replace: true });
            } else if (res.data.role === "admin") {
                nav("/admin", { replace: true });
            } else {
                nav("/app", { replace: true });
            }
        }   catch {
            setErr("Invalid email or password.");
        }
    };

return (
    <div className="auth-page fade-in premium-auth-page">
        <div className="auth-bg-orb auth-orb-1" />
        <div className="auth-bg-orb auth-orb-2" />
        <div className="auth-grid-overlay" />

        <div className="auth-card premium-auth-card">
        <div className="auth-glow" />

        <div className="auth-header">
            <img src={logo} alt="Resilience Logo" className="auth-logo" />

            <span className="auth-eyebrow">Welcome back</span>

            <h2 className="auth-title">Sign in to Resilience</h2>

            <p className="auth-text">
            Continue to your dashboard, analytics, and community.
            </p>
        </div>

        <form onSubmit={submit} className="auth-form premium-auth-form">
            <div className="field premium-field">
            <label>Email</label>
            <input
                type="text"
                placeholder="Enter your email"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
            />
            </div>

            <div className="field premium-field">
            <label>Password</label>
            <input
                type="password"
                placeholder="Enter password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
            />
            </div>

            <button className="btn btn-primary premium-auth-btn" type="submit">
            Login
            </button>
        </form>

        {err ? <p className="error-text">{err}</p> : null}

        <p className="auth-footer">
            No account yet? <Link to="/register">Register</Link>
        </p>
        </div>
    </div>
    );
}