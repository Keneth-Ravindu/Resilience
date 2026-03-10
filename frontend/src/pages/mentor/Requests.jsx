import { useEffect, useState } from "react";
import api from "../../api/client";

export default function Requests() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState("");

  const loadRequests = async () => {
    try {
      setError("");
      setLoading(true);
      const res = await api.get("/mentors/requests/pending/detailed");
      setRequests(res.data || []);
    } catch {
      setError("Failed to load mentor requests.");
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
      await api.post(`/mentors/accept?mentee_user_id=${menteeUserId}`);
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
      await api.post(`/mentors/reject?mentee_user_id=${menteeUserId}`);
      await loadRequests();
    } catch {
      setError("Failed to reject request.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="fade-in">
      <h2 className="page-title">Mentor Requests</h2>

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
        <div className="card-grid">
          {requests.map((req) => (
            <section className="glass-card request-card" key={req.id}>
              <div className="request-card-head">
                <div>
                  <h3>Request #{req.id}</h3>
                  <p>
                    From: <strong>{req.mentee?.email || `User ${req.mentee?.id}`}</strong>
                  </p>
                </div>
                <span className="role-badge">{req.status}</span>
              </div>

              <div className="request-meta">
                <p>Mentee ID: {req.mentee?.id}</p>
                <p>Mentor ID: {req.mentor?.id}</p>
                <p>Created: {new Date(req.created_at).toLocaleString()}</p>
              </div>

              <div className="request-actions">
                <button
                  className="btn btn-primary"
                  onClick={() => handleAccept(req.mentee.id)}
                  disabled={busyId === req.mentee.id}
                >
                  {busyId === req.mentee.id ? "Working..." : "Accept"}
                </button>

                <button
                  className="btn btn-outline"
                  onClick={() => handleReject(req.mentee.id)}
                  disabled={busyId === req.mentee.id}
                >
                  Reject
                </button>
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}