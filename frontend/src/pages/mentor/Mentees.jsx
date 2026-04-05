import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../api/client";

export default function Mentees() {
  const [mentees, setMentees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadMentees = async () => {
    try {
      setError("");
      setLoading(true);

      const res = await api.get("/mentors/mentees");
      setMentees(res.data || []);
    } catch {
      setError("Failed to load active mentees.");
      setMentees([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMentees();
  }, []);

  return (
    <div className="fade-in">
      <div className="dashboard-head">
        <div>
          <h2 className="page-title">Active Mentees</h2>
          <p className="page-subtitle">
            View your accepted mentees and open their analytics dashboards.
          </p>
        </div>
      </div>

      <div className="stats-grid">
        <section className="glass-card stat-card">
          <p className="stat-label">Active Mentees</p>
          <h3 className="stat-value">{mentees.length}</h3>
          <p className="stat-text">Accepted mentees currently under your support.</p>
        </section>
      </div>

      {error ? <p className="error-text">{error}</p> : null}

      {loading ? (
        <section className="glass-card">
          <p>Loading mentees...</p>
        </section>
      ) : mentees.length === 0 ? (
        <section className="glass-card">
          <h3>No active mentees</h3>
          <p>You do not have any accepted mentees yet.</p>
        </section>
      ) : (
        <div className="summary-grid">
          {mentees.map((m) => (
            <div className="summary-card" key={m.id}>
              <p className="summary-alert">Mentee #{m.mentee_user_id}</p>

              <p>
                <span className="summary-label">Mentorship ID:</span>
                <br />
                <strong>{m.id}</strong>
              </p>

              <p>
                <span className="summary-label">Status:</span>
                <br />
                <strong>{m.status}</strong>
              </p>

              <p>
                <span className="summary-label">Created:</span>
                <br />
                <strong>{new Date(m.created_at).toLocaleString()}</strong>
              </p>

              <Link
                to={`/mentor/mentees/${m.mentee_user_id}/analytics`}
                className="btn btn-primary btn-sm"
              >
                View Analytics
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}