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

  async function handleSearch(e) {
    e.preventDefault();

    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      setSearched(false);
      return;
    }

    try {
      setLoading(true);
      setError("");
      const res = await api.get(`/users/search?q=${encodeURIComponent(trimmed)}`);
      setResults(res.data || []);
      setSearched(true);
    } catch {
      setError("Failed to search users.");
      setResults([]);
      setSearched(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fade-in">
      <div className="page-head-with-actions">
        <div>
          <h2 className="page-title">Find Members</h2>
          <p className="page-subtitle">
            Search community members by display name or name.
          </p>
        </div>
      </div>

      <section className="glass-card user-search-card">
        <form onSubmit={handleSearch} className="user-search-form">
          <input
            type="text"
            placeholder="Search for a member..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button className="btn btn-primary" type="submit" disabled={loading}>
            {loading ? "Searching..." : "Search"}
          </button>
        </form>

        {error ? <p className="error-text">{error}</p> : null}

        {!searched ? (
          <p className="feed-meta">Search by display name or name.</p>
        ) : results.length === 0 ? (
          <p className="feed-meta">No users found.</p>
        ) : (
          <div className="user-search-results">
            {results.map((user) => {
              const displayName = getDisplayName(user);

              return (
                <Link
                  key={user.id}
                  to={`/app/profile/${user.id}`}
                  className="user-search-result-card"
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
                      {user.age_range ? <span className="tag-pill">{user.age_range}</span> : null}
                      {user.fitness_level ? <span className="tag-pill">{user.fitness_level}</span> : null}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}