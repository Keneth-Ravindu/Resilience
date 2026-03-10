import { useAuth } from "../auth/useAuth";
import logo from "../assets/logo.png";

export default function Navbar() {
    const { role, logout } = useAuth();

    return (
        <header className="topbar">
        <div className="brand-wrap">
            <img src={logo} alt="Resilience Logo" className="navbar-logo" />
            <div>
                <h1 className="brand-title">Resilience</h1>
                <p className="brand-subtitle">emotion intelligence platform</p>
            </div>
        </div>

        <div className="topbar-actions">
            <span className="role-badge">{role}</span>
            <button className="btn btn-outline" onClick={logout}>
            Logout
            </button>
        </div>
        </header>
    );
}