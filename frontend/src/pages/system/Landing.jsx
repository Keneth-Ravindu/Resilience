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
        <div className="landing-page fade-in premium-landing-page">
        <div className="landing-bg-orb landing-orb-1" />
        <div className="landing-bg-orb landing-orb-2" />
        <div className="premium-landing-grid-overlay" />

        <div className="landing-content premium-landing-content">
            <div className="landing-logo-wrap premium-landing-logo-wrap">
            <img src={logo} alt="Resilience Logo" className="landing-logo" />
            </div>

            <div className="premium-landing-hero-copy">
            <span className="premium-landing-eyebrow">
                AI-powered fitness and emotional wellbeing
            </span>

            <h1 className="landing-title premium-landing-title">Resilience</h1>

            <p className="landing-subtitle premium-landing-subtitle">
                A physical and mental fitness platform designed to help people build
                emotional resilience, share progress, and grow through a supportive
                community.
            </p>
            </div>

            <div className="landing-actions premium-landing-actions">
            <Link to="/login" className="btn btn-primary">
                Get Started
            </Link>
            <Link to="/register" className="btn btn-outline">
                Create Account
            </Link>
            </div>

            <div className="premium-landing-stats">
            <div className="premium-landing-stat">
                <strong>AI Moderation</strong>
                <span>Safer community interaction</span>
            </div>
            <div className="premium-landing-stat">
                <strong>Workout Detection</strong>
                <span>Structured fitness insights</span>
            </div>
            <div className="premium-landing-stat">
                <strong>Support Network</strong>
                <span>Friends, mentors, and guidance</span>
            </div>
            </div>

            <div className="landing-feature-grid premium-landing-feature-grid">
            <div className="glass-card landing-feature-card premium-landing-feature-card">
                <div className="premium-landing-feature-icon">🧠</div>
                <h3>NLP Insights</h3>
                <p>
                Analyze posts, comments, and journals for emotion, tone, and
                toxicity patterns.
                </p>
            </div>

            <div className="glass-card landing-feature-card premium-landing-feature-card">
                <div className="premium-landing-feature-icon">✨</div>
                <h3>AI Rewrites</h3>
                <p>
                Transform harmful content into calmer, more constructive, and
                supportive language.
                </p>
            </div>

            <div className="glass-card landing-feature-card premium-landing-feature-card">
                <div className="premium-landing-feature-icon">🤝</div>
                <h3>Mentor Support</h3>
                <p>
                Connect with mentors who can observe emotional trends and provide
                guidance when needed.
                </p>
            </div>
            </div>
        </div>
        </div>
    );
}