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
      <div className="fade-in premium-myprofile-page">
        <div className="glass-card premium-myprofile-hero">
          <div className="premium-myprofile-hero-content">
            <span className="premium-myprofile-eyebrow">Profile</span>
            <h2 className="page-title">My Profile</h2>
            <p className="page-subtitle">Loading your profile...</p>
          </div>
        </div>

        <section className="glass-card premium-myprofile-empty-card">
          <p>Loading profile...</p>
        </section>
      </div>
    );
  }

  const displayName = profile?.display_name || profile?.name || "User";

  return (
    <div className="fade-in premium-myprofile-page">
      <div className="glass-card premium-myprofile-hero">
        <div className="premium-myprofile-hero-content">
          <span className="premium-myprofile-eyebrow">Profile</span>
          <h2 className="page-title">My Profile</h2>
          <p className="page-subtitle premium-myprofile-subtitle">
            View your posts, journals, and personal profile details in one place.
          </p>
        </div>
      </div>

      <section className="glass-card public-profile-card premium-myprofile-header-card">
        <div className="public-profile-header premium-myprofile-header">
          {profile?.profile_picture_url ? (
            <img
              src={resolveMediaUrl(profile.profile_picture_url)}
              alt={displayName}
              className="public-profile-avatar premium-myprofile-avatar"
            />
          ) : (
            <div className="public-profile-avatar public-profile-avatar-fallback premium-myprofile-avatar">
              {displayName.charAt(0).toUpperCase()}
            </div>
          )}

          <div className="public-profile-meta premium-myprofile-meta">
            <h2 className="page-title premium-myprofile-name">{displayName}</h2>

            <p className="page-subtitle premium-myprofile-status">
              {profile?.status_text || "No status added yet."}
            </p>

            <div className="public-profile-badges premium-myprofile-badges">
              {profile?.age_range && <span className="tag-pill">{profile.age_range}</span>}
              {profile?.fitness_level && <span className="tag-pill">{profile.fitness_level}</span>}
            </div>
          </div>
        </div>
      </section>

      <div className="profile-page-grid premium-myprofile-grid">
        <section className="profile-column-main premium-myprofile-column">
          <div className="premium-myprofile-section-head">
            <h3 className="section-title">My Posts</h3>
            <span className="premium-myprofile-count">{posts.length}</span>
          </div>

          {posts.length === 0 ? (
            <section className="glass-card premium-myprofile-empty-card">
              <p>No posts yet.</p>
            </section>
          ) : (
            posts.map((post) => (
              <section
                className="glass-card profile-content-card premium-myprofile-content-card"
                key={post.id}
              >
                <div className="premium-myprofile-card-top">
                  <span className="premium-myprofile-card-type">Post</span>
                  <span className="feed-subtitle">{formatDate(post.created_at)}</span>
                </div>

                <p className="premium-myprofile-content-text">{post.content}</p>
              </section>
            ))
          )}
        </section>

        <aside className="profile-column-side premium-myprofile-column">
          <div className="premium-myprofile-section-head">
            <h3 className="section-title">My Journals</h3>
            <span className="premium-myprofile-count">{journals.length}</span>
          </div>

          {journals.length === 0 ? (
            <section className="glass-card premium-myprofile-empty-card">
              <p>No journals yet.</p>
            </section>
          ) : (
            journals.map((journal) => (
              <section
                className="glass-card profile-content-card premium-myprofile-content-card"
                key={journal.id}
              >
                <div className="premium-myprofile-card-top">
                  <span className="premium-myprofile-card-type">Journal</span>
                </div>

                <h4 className="premium-myprofile-journal-title">{journal.title}</h4>
                <p className="premium-myprofile-content-text">{journal.content}</p>
              </section>
            ))
          )}
        </aside>
      </div>
    </div>
  );
}