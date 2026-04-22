import { useState } from "react";
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
  return user.display_name || user.name || `User #${user.id}`;
}

export default function UserSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState("");
  const [friendStates, setFriendStates] = useState({});

  async function handleSearch(e) {
    e.preventDefault();

    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      setFriendStates({});
      setSearched(false);
      setError("");
      return;
    }

    try {
      setLoading(true);
      setError("");

      const res = await api.get(`/users/search?q=${encodeURIComponent(trimmed)}`);
      const users = res.data || [];

      setResults(users);
      setSearched(true);

      const statusEntries = await Promise.all(
        users.map(async (user) => {
          try {
            const statusRes = await api.get(`/friend-requests/status/${user.id}`);
            return [
              user.id,
              {
                status: statusRes.data?.status || "none",
                request_id: statusRes.data?.request_id || null,
              },
            ];
          } catch {
            return [
              user.id,
              {
                status: "none",
                request_id: null,
              },
            ];
          }
        })
      );

      setFriendStates(Object.fromEntries(statusEntries));
    } catch {
      setError("Failed to search users.");
      setResults([]);
      setFriendStates({});
      setSearched(true);
    } finally {
      setLoading(false);
    }
  }

  async function sendFriendRequest(userId) {
    try {
      setError("");

      const res = await api.post(`/friend-requests/${userId}`);

      setFriendStates((prev) => ({
        ...prev,
        [userId]: {
          status: "pending_sent",
          request_id: res.data?.id || prev[userId]?.request_id || null,
        },
      }));
    } catch (err) {
      const detail = err?.response?.data?.detail;
      if (detail === "Request already sent") {
        setFriendStates((prev) => ({
          ...prev,
          [userId]: {
            ...(prev[userId] || {}),
            status: "pending_sent",
          },
        }));
      } else {
        setError("Failed to send friend request.");
      }
    }
  }

  async function acceptFriendRequest(userId, requestId) {
    try {
      setError("");

      await api.post(`/friend-requests/${requestId}/accept`);

      setFriendStates((prev) => ({
        ...prev,
        [userId]: {
          ...(prev[userId] || {}),
          status: "friends",
          request_id: requestId,
        },
      }));
    } catch {
      setError("Failed to accept friend request.");
    }
  }

  async function rejectFriendRequest(userId, requestId) {
    try {
      setError("");

      await api.post(`/friend-requests/${requestId}/reject`);

      setFriendStates((prev) => ({
        ...prev,
        [userId]: {
          status: "none",
          request_id: null,
        },
      }));
    } catch {
      setError("Failed to reject friend request.");
    }
  }

  return (
    <div className="fade-in premium-usersearch-page">
      <div className="glass-card premium-usersearch-hero">
        <div className="premium-usersearch-hero-content">
          <span className="premium-usersearch-eyebrow">Community</span>
          <h2 className="page-title">Find Members</h2>
          <p className="page-subtitle premium-usersearch-subtitle">
            Search community members by display name or name.
          </p>
        </div>
      </div>

      <section className="glass-card user-search-card premium-usersearch-card">
        <form onSubmit={handleSearch} className="user-search-form premium-usersearch-form">
          <input
            type="text"
            placeholder="Search for a member..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button className="btn btn-primary premium-usersearch-submit" type="submit" disabled={loading}>
            {loading ? "Searching..." : "Search"}
          </button>
        </form>

        {error ? <p className="error-text">{error}</p> : null}

        {!searched ? (
          <div className="premium-usersearch-empty">
            <p className="feed-meta">Search by display name or name.</p>
          </div>
        ) : results.length === 0 ? (
          <div className="premium-usersearch-empty">
            <p className="feed-meta">No users found.</p>
          </div>
        ) : (
          <div className="user-search-results premium-usersearch-results">
            {results.map((user) => {
              const displayName = getDisplayName(user);
              const relation = friendStates[user.id] || {
                status: "none",
                request_id: null,
              };

              return (
                <div key={user.id} className="user-search-result-card premium-usersearch-result-card">
                  <Link
                    to={`/app/profile/${user.id}`}
                    className="feed-author-link premium-usersearch-link"
                  >
                    {user.profile_picture_url ? (
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
                      <p>{user.status_text || "No status added yet."}</p>

                      <div className="user-search-tags">
                        {user.age_range ? (
                          <span className="tag-pill">{user.age_range}</span>
                        ) : null}
                        {user.fitness_level ? (
                          <span className="tag-pill">{user.fitness_level}</span>
                        ) : null}
                      </div>
                    </div>
                  </Link>

                  <div className="premium-usersearch-actions">
                    {relation.status === "self" ? (
                      <button type="button" className="btn btn-secondary btn-sm" disabled>
                        You
                      </button>
                    ) : relation.status === "friends" ? (
                      <button type="button" className="btn btn-secondary btn-sm" disabled>
                        Friends
                      </button>
                    ) : relation.status === "pending_sent" ? (
                      <button type="button" className="btn btn-secondary btn-sm" disabled>
                        Request Sent
                      </button>
                    ) : relation.status === "pending_received" ? (
                      <>
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          onClick={() =>
                            acceptFriendRequest(user.id, relation.request_id)
                          }
                        >
                          Accept
                        </button>
                        <button
                          type="button"
                          className="btn btn-outline btn-sm"
                          onClick={() =>
                            rejectFriendRequest(user.id, relation.request_id)
                          }
                        >
                          Reject
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        onClick={() => sendFriendRequest(user.id)}
                      >
                        Add Friend
                      </button>
                    )}
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