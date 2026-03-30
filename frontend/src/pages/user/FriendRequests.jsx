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
  if (!user) return "User";
  return user.display_name || user.name || `User #${user.id}`;
}

export default function FriendRequests() {
  const [requests, setRequests] = useState([]);
  const [usersMap, setUsersMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function loadRequests() {
    try {
      setLoading(true);
      setError("");

      const res = await api.get("/friend-requests/incoming");
      const requestsData = res.data || [];
      setRequests(requestsData);

      // 🔥 Fetch user details
      const userEntries = await Promise.all(
        requestsData.map(async (req) => {
          try {
            const userRes = await api.get(`/users/${req.requester_id}`);
            return [req.requester_id, userRes.data];
          } catch {
            return [req.requester_id, null];
          }
        })
      );

      setUsersMap(Object.fromEntries(userEntries));
    } catch {
      setError("Failed to load friend requests.");
      setRequests([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadRequests();
  }, []);

  async function acceptRequest(requestId) {
    try {
      setActionLoadingId(requestId);
      setError("");
      setMessage("");

      await api.post(`/friend-requests/${requestId}/accept`);
      setMessage("Friend request accepted.");
      await loadRequests();
    } catch {
      setError("Failed to accept request.");
    } finally {
      setActionLoadingId(null);
    }
  }

  async function rejectRequest(requestId) {
    try {
      setActionLoadingId(requestId);
      setError("");
      setMessage("");

      await api.post(`/friend-requests/${requestId}/reject`);
      setMessage("Friend request rejected.");
      await loadRequests();
    } catch {
      setError("Failed to reject request.");
    } finally {
      setActionLoadingId(null);
    }
  }

  return (
    <div className="fade-in">
      <div className="page-head-with-actions">
        <div>
          <h2 className="page-title">Friend Requests</h2>
          <p className="page-subtitle">
            Manage incoming connection requests.
          </p>
        </div>
      </div>

      <section className="glass-card">
        {message ? <p className="success-text">{message}</p> : null}
        {error ? <p className="error-text">{error}</p> : null}

        {loading ? (
          <p>Loading requests...</p>
        ) : requests.length === 0 ? (
          <p className="feed-meta">No incoming friend requests.</p>
        ) : (
          <div className="user-search-results">
            {requests.map((req) => {
              const user = usersMap[req.requester_id];
              const displayName = getDisplayName(user);

              return (
                <div className="user-search-result-card" key={req.id}>
                  <Link
                    to={`/app/profile/${req.requester_id}`}
                    className="user-search-result"
                  >
                    {user?.profile_picture_url ? (
                      <img
                        src={resolveMediaUrl(user.profile_picture_url)}
                        alt={displayName}
                        className="user-search-avatar"
                      />
                    ) : (
                      <div className="user-search-avatar user-search-avatar-fallback">
                        {displayName.charAt(0).toUpperCase()}
                      </div>
                    )}

                    <div className="user-search-result-content">
                      <h3>{displayName}</h3>
                      <p>{user?.status_text || "No status available."}</p>
                    </div>
                  </Link>

                  <div className="quick-actions">
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => acceptRequest(req.id)}
                      disabled={actionLoadingId === req.id}
                    >
                      {actionLoadingId === req.id ? "..." : "Accept"}
                    </button>

                    <button
                      className="btn btn-outline btn-sm"
                      onClick={() => rejectRequest(req.id)}
                      disabled={actionLoadingId === req.id}
                    >
                      Reject
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}