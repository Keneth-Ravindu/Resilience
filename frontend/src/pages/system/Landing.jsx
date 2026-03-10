import { Link, Navigate } from "react-router-dom";
import logo from "../../assets/logo.png";
import { useAuth } from "../../auth/useAuth";

export default function Landing() {
    const { token, role } = useAuth();

    if (token) {
        if (role === "admin") return <Navigate to="/admin" replace />;
        if (role === "mentor") return <Navigate to="/mentor" replace />;
        return <Navigate to="/app" replace />;
    }

    return (
        <div className="landing-page fade-in">
            <div className="landing-bg-orb landing-orb-1" />
            <div className="landing-bg-orb landing-orb-2" />

            <div className="landing-content">
                <div className="landing-logo-wrap">
                    <img src={logo} alt="Resilience Logo" className="landing-logo" />
                </div>

                <p className="landing-eyebrow">Final Year Computer Science Project</p>
                <h1 className="landing-title">Resilience</h1>
                <p className="landing-subtitle">
                    A platform for emotional insight, toxicity detection, rewrite support,
                    mentorship, and mental trend analytics.
                </p>

                <div className="landing-actions">
                    <Link to="/login" className="btn btn-primary">
                        Get Started
                    </Link>
                    <Link to="/register" className="btn btn-outline">
                        Create Account
                    </Link>
                </div>

                <div className="landing-feature-grid">
                    <div className="glass-card landing-feature-card">
                        <h3>NLP Insights</h3>
                        <p>Analyze posts, comments, and journals for emotions, tone, and toxicity.</p>
                    </div>

                    <div className="glass-card landing-feature-card">
                        <h3>AI Rewrites</h3>
                        <p>Transform harmful content into more supportive, constructive language.</p>
                    </div>

                    <div className="glass-card landing-feature-card">
                        <h3>Mentor Support</h3>
                        <p>Connect with mentors who can track emotional patterns and provide guidance.</p>
                    </div>
                </div>
            </div>
        </div>
    );
}