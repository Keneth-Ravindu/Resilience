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

export default function Requests() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const loadRequests = async () => {
    try {
      setError("");
      setLoading(true);

      const res = await api.get("/mentors/requests/pending/detailed");
      setRequests(res.data || []);
    } catch {
      setError("Failed to load mentor requests.");
      setRequests([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRequests();
  }, []);

  const handleAccept = async (menteeUserId) => {
    try {
      setBusyId(menteeUserId);
      setError("");
      setMessage("");

      await api.post(`/mentors/accept?mentee_user_id=${menteeUserId}`);
      setMessage("Mentorship request accepted.");
      await loadRequests();
    } catch {
      setError("Failed to accept request.");
    } finally {
      setBusyId(null);
    }
  };

  const handleReject = async (menteeUserId) => {
    try {
      setBusyId(menteeUserId);
      setError("");
      setMessage("");

      await api.post(`/mentors/reject?mentee_user_id=${menteeUserId}`);
      setMessage("Mentorship request rejected.");
      await loadRequests();
    } catch {
      setError("Failed to reject request.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="fade-in">
      <div className="dashboard-head">
        <div>
          <h2 className="page-title">Mentor Requests</h2>
          <p className="page-subtitle">
            Review pending mentorship requests and decide who to accept.
          </p>
        </div>
      </div>

      <div className="stats-grid">
        <section className="glass-card stat-card">
          <p className="stat-label">Pending Requests</p>
          <h3 className="stat-value">{requests.length}</h3>
          <p className="stat-text">Requests currently waiting for your response.</p>
        </section>
      </div>

      {message ? <p className="success-text">{message}</p> : null}
      {error ? <p className="error-text">{error}</p> : null}

      {loading ? (
        <section className="glass-card">
          <p>Loading requests...</p>
        </section>
      ) : requests.length === 0 ? (
        <section className="glass-card">
          <h3>No pending requests</h3>
          <p>You do not have any pending mentorship requests right now.</p>
        </section>
      ) : (
        <div className="summary-grid">
          {requests.map((req) => {
            const mentee = req.mentee;
            const isBusy = busyId === mentee?.id;

            return (
              <div className="summary-card" key={req.id}>
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
                  <span className="summary-label">Role:</span>
                  <br />
                  <strong>{mentee?.role || "user"}</strong>
                </p>

                <p>
                  <span className="summary-label">Fitness level:</span>
                  <br />
                  <strong>{mentee?.fitness_level || "Not set"}</strong>
                </p>

                <p>
                  <span className="summary-label">Created:</span>
                  <br />
                  <strong>{new Date(req.created_at).toLocaleString()}</strong>
                </p>

                <div className="quick-actions">
                  <Link
                    to={`/app/profile/${mentee?.id}`}
                    className="btn btn-outline btn-sm"
                  >
                    View Profile
                  </Link>

                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => handleAccept(mentee.id)}
                    disabled={isBusy}
                  >
                    {isBusy ? "Working..." : "Accept"}
                  </button>

                  <button
                    className="btn btn-outline btn-sm"
                    onClick={() => handleReject(mentee.id)}
                    disabled={isBusy}
                  >
                    Reject
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}