import { useEffect, useState } from "react";
import api from "../../api/client";

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
          {requests.map((req) => (
            <div className="summary-card" key={req.id}>
              <p className="summary-alert">Request #{req.id}</p>

              <p>
                <span className="summary-label">From:</span>
                <br />
                <strong>{req.mentee?.email || `User ${req.mentee?.id}`}</strong>
              </p>

              <p>
                <span className="summary-label">Mentee ID:</span>
                <br />
                <strong>{req.mentee?.id}</strong>
              </p>

              <p>
                <span className="summary-label">Created:</span>
                <br />
                <strong>{new Date(req.created_at).toLocaleString()}</strong>
              </p>

              <div className="quick-actions">
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => handleAccept(req.mentee.id)}
                  disabled={busyId === req.mentee.id}
                >
                  {busyId === req.mentee.id ? "Working..." : "Accept"}
                </button>

                <button
                  className="btn btn-outline btn-sm"
                  onClick={() => handleReject(req.mentee.id)}
                  disabled={busyId === req.mentee.id}
                >
                  Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}