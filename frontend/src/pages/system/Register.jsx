import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../../api/client";
import logo from "../../assets/logo.png";
import CustomSelect from "../../components/CustomSelect";

export default function Register() {
  const nav = useNavigate();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [ageRange, setAgeRange] = useState("");
  const [fitnessLevel, setFitnessLevel] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setMessage("");

    const trimmedName = name.trim();
    const trimmedEmail = email.trim().toLowerCase();

    if (!trimmedName) {
      setError("Name is required.");
      return;
    }

    if (!trimmedEmail) {
      setError("Email is required.");
      return;
    }

    if (!password) {
      setError("Password is required.");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    try {
      setLoading(true);

      const payload = {
        name: trimmedName,
        email: trimmedEmail,
        password,
        confirm_password: confirmPassword,
        age_range: ageRange || null,
        fitness_level: fitnessLevel || null,
        role: "user",
      };

      await api.post("/auth/register", payload);

      setMessage("Account created successfully. Redirecting to login...");

      setName("");
      setEmail("");
      setPassword("");
      setConfirmPassword("");
      setAgeRange("");
      setFitnessLevel("");

      setTimeout(() => {
        nav("/login", { replace: true });
      }, 1200);
    } catch (err) {
      const detail = err?.response?.data?.detail;

      if (typeof detail === "string") {
        setError(detail);
      } else {
        setError("Registration failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page fade-in">
      <div className="auth-card">
        <div className="auth-glow" />
        <img src={logo} alt="Resilience Logo" className="auth-logo" />

        <p className="eyebrow">Create account</p>
        <h2 className="auth-title">Join Resilience</h2>
        <p className="auth-text">
          Create your account to start posting, journaling, tracking analytics,
          and connecting with the community.
        </p>

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="field">
            <label>Name</label>
            <input
              type="text"
              placeholder="Enter your full name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="field">
            <label>Email</label>
            <input
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="field">
            <CustomSelect
              label="Age Range"
              value={ageRange}
              onChange={setAgeRange}
              options={[
                { value: "", label: "Select age range" },
                { value: "13-17", label: "13-17" },
                { value: "18-24", label: "18-24" },
                { value: "25-34", label: "25-34" },
                { value: "35-44", label: "35-44" },
                { value: "45+", label: "45+" },
              ]}
            />
          </div>

          <div className="field">
            <CustomSelect
              label="Fitness Level"
              value={fitnessLevel}
              onChange={setFitnessLevel}
              options={[
                { value: "", label: "Select fitness level" },
                { value: "beginner", label: "Beginner" },
                { value: "intermediate", label: "Intermediate" },
                { value: "advanced", label: "Advanced" },
              ]}
            />
          </div>

          <div className="field">
            <label>Password</label>
            <input
              type="password"
              placeholder="Minimum 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <div className="field">
            <label>Confirm Password</label>
            <input
              type="password"
              placeholder="Re-enter your password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </div>

          <button className="btn btn-primary" type="submit" disabled={loading}>
            {loading ? "Creating Account..." : "Register"}
          </button>
        </form>

        {message ? <p className="success-text">{message}</p> : null}
        {error ? <p className="error-text">{error}</p> : null}

        <p className="auth-footer">
          Already have an account? <Link to="/login">Login</Link>
        </p>
      </div>
    </div>
  );
}