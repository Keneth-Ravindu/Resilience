import { Link } from "react-router-dom";

export default function Register() {
    return (
        <div className="auth-page fade-in">
            <div className="auth-card">
                <p className="eyebrow">Create account</p>
                <h2 className="auth-title">Register</h2>
                <p className="auth-text">
                    We will connect this page to your backend register endpoint next.
                </p>

                <div className="coming-soon-box">
                    Registration form will be wired in the next step.
                </div>

                <p className="auth-footer">
                    Already have an account? <Link to="/login">Login</Link>
                </p>
            </div>
        </div>
    );
}