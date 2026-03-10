import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import api from "../../api/client";
import { useAuth } from "../../auth/useAuth";
import logo from "../../assets/logo.png";
import CustomSelect from "../../components/CustomSelect";


export default function Login() {
    const { login } = useAuth();
    const nav = useNavigate();
    const loc = useLocation();

    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [role, setRole] = useState("user");
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

            login({ access_token: res.data.access_token, role });
            nav(loc.state?.from || "/", { replace: true });
        }   catch {
            setErr("Login failed");
        }
    };

    return (
        <div className="auth-page fade-in">
            <div className="auth-card">
                <div className="auth-glow" />
                <img src={logo} alt="Resilience Logo" className="auth-logo" />           
                <p className="eyebrow">Welcome back</p>
                <h2 className="auth-title">Sign in to Resilience</h2>
                <p className="auth-text">
                    Continue to your dashboard, analytics, and mentor tools.
                </p>

                <form onSubmit={submit} className="auth-form">
                    <div className="field">
                        <label>Email</label>
                        <input
                        type="text"
                        placeholder="mentor@gmail.com"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        />
                    </div>

                    <div className="field">
                        <label>Password</label>
                        <input
                        type="password"
                        placeholder="Enter password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        />
                    </div>
                    <div className="field">
                    <CustomSelect
                        label="Role (temporary frontend selector)"
                        value={role}
                        onChange={setRole}
                        options={[
                        { value: "user", label: "user" },
                        { value: "mentor", label: "mentor" },
                        { value: "admin", label: "admin" },
                        ]}
                    />
                    </div>

                    <button className="btn btn-primary" type="submit">
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