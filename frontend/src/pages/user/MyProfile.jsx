import { useEffect, useState } from "react";
import api from "../../api/client";

const API_BASE_URL = "http://127.0.0.1:8000";

function resolveMediaUrl(url) {
  if (!url) return null;
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  return `${API_BASE_URL}${url}`;
}

function formatDate(dateValue) {
  if (!dateValue) return "N/A";
  return new Date(dateValue).toLocaleString();
}

export default function MyProfile() {
  const [profile, setProfile] = useState(null);
  const [posts, setPosts] = useState([]);
  const [journals, setJournals] = useState([]);

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadProfile() {
      try {
        const profileRes = await api.get("/users/me");
        setProfile(profileRes.data);

        const postsRes = await api.get(`/users/${profileRes.data.id}/posts`);
        setPosts(postsRes.data || []);

        const journalsRes = await api.get(`/users/${profileRes.data.id}/journals`);
        setJournals(journalsRes.data || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    loadProfile();
  }, []);

  if (loading) {
    return (
      <div className="fade-in">
        <h2 className="page-title">My Profile</h2>
        <section className="glass-card">
          <p>Loading profile...</p>
        </section>
      </div>
    );
  }

  const displayName = profile?.display_name || profile?.name || "User";

  return (
    <div className="fade-in">

      <section className="glass-card public-profile-card">
        <div className="public-profile-header">
          {profile?.profile_picture_url ? (
            <img
              src={resolveMediaUrl(profile.profile_picture_url)}
              alt={displayName}
              className="public-profile-avatar"
            />
          ) : (
            <div className="public-profile-avatar public-profile-avatar-fallback">
              {displayName.charAt(0).toUpperCase()}
            </div>
          )}

          <div className="public-profile-meta">
            <h2 className="page-title">{displayName}</h2>

            <p className="page-subtitle">
              {profile?.status_text || "No status added yet."}
            </p>

            <div className="public-profile-badges">
              {profile?.age_range && <span className="tag-pill">{profile.age_range}</span>}
              {profile?.fitness_level && <span className="tag-pill">{profile.fitness_level}</span>}
            </div>
          </div>
        </div>
      </section>

      <div className="profile-page-grid">

        <section className="profile-column-main">
          <h3 className="section-title">My Posts</h3>

          {posts.length === 0 ? (
            <section className="glass-card">
              <p>No posts yet.</p>
            </section>
          ) : (
            posts.map((post) => (
              <section className="glass-card profile-content-card" key={post.id}>
                <p>{post.content}</p>
                <span className="feed-subtitle">{formatDate(post.created_at)}</span>
              </section>
            ))
          )}
        </section>

        <aside className="profile-column-side">
          <h3 className="section-title">My Journals</h3>

          {journals.length === 0 ? (
            <section className="glass-card">
              <p>No journals yet.</p>
            </section>
          ) : (
            journals.map((journal) => (
              <section className="glass-card profile-content-card" key={journal.id}>
                <h4>{journal.title}</h4>
                <p>{journal.content}</p>
              </section>
            ))
          )}
        </aside>

      </div>
    </div>
  );
}