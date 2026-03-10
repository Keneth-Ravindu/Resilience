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
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMentees();
  }, []);

  return (
    <div className="fade-in">
      <h2 className="page-title">Active Mentees</h2>

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
        <div className="card-grid">
          {mentees.map((m) => (
            <section className="glass-card mentee-card" key={m.id}>
              <div className="mentee-card-head">
                <div>
                  <h3>Mentee #{m.mentee_user_id}</h3>
                  <p>Mentorship ID: {m.id}</p>
                </div>
                <span className="role-badge">{m.status}</span>
              </div>

              <div className="request-meta">
                <p>Mentor ID: {m.mentor_user_id}</p>
                <p>Accepted Mentee ID: {m.mentee_user_id}</p>
                <p>Created: {new Date(m.created_at).toLocaleString()}</p>
              </div>

              <div className="request-actions">
                <Link
                  to={`/mentor/mentees/${m.mentee_user_id}/analytics`}
                  className="btn btn-primary"
                >
                  View Analytics
                </Link>
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}