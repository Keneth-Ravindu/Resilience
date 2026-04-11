import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../api/client";

const API_BASE_URL = "http://127.0.0.1:8000";

function resolveMediaUrl(url) {
  if (!url) return null;
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  return `${API_BASE_URL}${url}`;
}

function getDisplayName(user) {
  if (!user) return "Unknown User";
  return user.display_name || user.name || user.email || `User #${user.id}`;
}

function getInitials(user) {
  const name = getDisplayName(user);
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function UserAvatar({ user }) {
  if (user?.profile_picture_url) {
    return (
      <img
        src={resolveMediaUrl(user.profile_picture_url)}
        alt={getDisplayName(user)}
        className="feed-avatar"
      />
    );
  }

  return <div className="feed-avatar feed-avatar-fallback">{getInitials(user)}</div>;
}

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
          {mentees.map((m) => {
            const mentee = m.mentee;

            return (
              <div className="summary-card" key={m.id}>
                <div className="comment-author-wrap" style={{ marginBottom: "12px" }}>
                  <UserAvatar user={mentee} />
                  <div>
                    <p className="summary-alert" style={{ marginBottom: "4px" }}>
                      {getDisplayName(mentee)}
                    </p>
                    <p className="feed-meta">{mentee?.email}</p>
                  </div>
                </div>

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
                  <span className="summary-label">Fitness level:</span>
                  <br />
                  <strong>{mentee?.fitness_level || "Not set"}</strong>
                </p>

                <div className="quick-actions">
                  <Link
                    to={`/app/profile/${mentee?.id}`}
                    className="btn btn-outline btn-sm"
                  >
                    View Profile
                  </Link>

                  <Link
                    to={`/mentor/mentees/${mentee?.id}/analytics`}
                    className="btn btn-primary btn-sm"
                  >
                    View Analytics
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}