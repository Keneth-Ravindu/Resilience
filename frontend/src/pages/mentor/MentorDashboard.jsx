import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../api/client";

function RiskBadge({ level }) {
  const cls =
    level === "high"
      ? "trend-up"
      : level === "moderate"
      ? "trend-stable"
      : "trend-down";

  return <span className={`trend-badge ${cls}`}>{level}</span>;
}

export default function MentorDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadDashboard = async () => {
      try {
        setLoading(true);
        setError("");

        const res = await api.get("/mentors/dashboard/overview", {
          params: { days: 30 },
        });

        setData(res.data);
      } catch {
        setError("Failed to load mentor dashboard.");
      } finally {
        setLoading(false);
      }
    };

    loadDashboard();
  }, []);

  if (loading) {
    return (
      <div className="fade-in">
        <h2 className="page-title">Mentor Dashboard</h2>
        <section className="glass-card">
          <p>Loading dashboard...</p>
        </section>
      </div>
    );
  }

  if (error) {
    return (
      <div className="fade-in">
        <h2 className="page-title">Mentor Dashboard</h2>
        <p className="error-text">{error}</p>
      </div>
    );
  }

  const mentees = data?.mentees || [];
  const highRiskCount = mentees.filter((m) => m.risk_level === "high").length;

  return (
    <div className="fade-in">
      <div className="dashboard-head">
        <div>
          <h2 className="page-title">Mentor Dashboard</h2>
          <p className="page-subtitle">
            Review mentee wellbeing patterns and identify users who may need support.
          </p>
        </div>
      </div>

      <div className="stats-grid">
        <section className="glass-card stat-card">
          <p className="stat-label">Pending Requests</p>
          <h3 className="stat-value">{data?.pending_requests_count ?? 0}</h3>
          <p className="stat-text">Mentorship requests waiting for your decision.</p>
        </section>

        <section className="glass-card stat-card">
          <p className="stat-label">Active Mentees</p>
          <h3 className="stat-value">{data?.active_mentees_count ?? 0}</h3>
          <p className="stat-text">Accepted mentees currently under your support.</p>
        </section>

        <section className="glass-card stat-card">
          <p className="stat-label">High Risk Mentees</p>
          <h3 className="stat-value">{highRiskCount}</h3>
          <p className="stat-text">Mentees showing stronger negative patterns.</p>
        </section>
      </div>

      <div className="card-grid">
        <section className="glass-card">
          <div className="section-head">
            <h3>Quick Actions</h3>
          </div>

          <div className="quick-actions">
            <Link to="/mentor/requests" className="btn btn-primary">
              Open Requests
            </Link>
            <Link to="/mentor/mentees" className="btn btn-outline">
              View Mentees
            </Link>
          </div>
        </section>

        <section className="glass-card">
          <div className="section-head">
            <h3>Risk Summary</h3>
          </div>

          {mentees.length ? (
            <div className="simple-list">
              {mentees.slice(0, 5).map((mentee) => (
                <div className="simple-list-item" key={mentee.mentee_user_id}>
                  <div>
                    <strong>{mentee.display_name || `User #${mentee.mentee_user_id}`}</strong>
                    <p>
                      Dominant emotion: {mentee.dominant_emotion || "No data"} | Toxicity:{" "}
                      {Number(mentee.avg_toxicity || 0).toFixed(3)}
                    </p>
                  </div>
                  <RiskBadge level={mentee.risk_level} />
                </div>
              ))}
            </div>
          ) : (
            <p>No mentee analytics available yet.</p>
          )}
        </section>
      </div>

      <section className="glass-card summary-section">
        <div className="section-head">
          <h3>Mentee Overview</h3>
        </div>

        {mentees.length ? (
          <div className="summary-grid">
            {mentees.map((mentee) => (
              <div className="summary-card" key={mentee.mentee_user_id}>
                <p className="summary-alert">
                  {mentee.display_name || `User #${mentee.mentee_user_id}`}
                </p>

                <p>
                  <span className="summary-label">Risk level:</span>
                  <br />
                  <strong>{mentee.risk_level}</strong>
                </p>

                <p>
                  <span className="summary-label">Dominant emotion:</span>
                  <br />
                  <strong>{mentee.dominant_emotion || "No data"}</strong>
                </p>

                <p>
                  <span className="summary-label">Average toxicity:</span>
                  <br />
                  <strong>{Number(mentee.avg_toxicity || 0).toFixed(3)}</strong>
                </p>

                <p>
                  <span className="summary-label">Flags:</span>
                  <br />
                  <strong>
                    {mentee.flags?.length ? mentee.flags.join(", ") : "No flags"}
                  </strong>
                </p>

                <Link
                  to={`/mentor/mentees/${mentee.mentee_user_id}/analytics`}
                  className="btn btn-primary btn-sm"
                >
                  Open Analytics
                </Link>
              </div>
            ))}
          </div>
        ) : (
          <p>No active mentees yet.</p>
        )}
      </section>
    </div>
  );
}