import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
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

function formatDate(dateValue) {
  if (!dateValue) return "N/A";
  return new Date(dateValue).toLocaleString();
}

function formatEntryDate(dateValue) {
  if (!dateValue) return "No date";
  return new Date(dateValue).toLocaleDateString();
}

function ProfileAvatar({ profile }) {
  const displayName = getDisplayName(profile);

  if (profile?.profile_picture_url) {
    return (
      <img
        src={resolveMediaUrl(profile.profile_picture_url)}
        alt={displayName}
        className="public-profile-avatar"
      />
    );
  }

  return (
    <div className="public-profile-avatar public-profile-avatar-fallback">
      {displayName.charAt(0).toUpperCase()}
    </div>
  );
}

function ProfilePostCard({ post }) {
  return (
    <article className="glass-card profile-content-card">
      <div className="profile-content-card-head">
        <div>
          <h3 className="profile-content-title">Post</h3>
          <p className="feed-subtitle">{formatDate(post.created_at)}</p>
        </div>
      </div>

      <p className="community-post-body">{post.content || "No content"}</p>

      {post.tags?.length ? (
        <div className="tag-row">
          {post.tags.map((tag, idx) => (
            <span className="tag-pill" key={`${post.id}-${tag}-${idx}`}>
              #{tag}
            </span>
          ))}
        </div>
      ) : null}

      {post.media_url && post.media_type === "image" ? (
        <div className="feed-media-wrap">
          <img
            src={resolveMediaUrl(post.media_url)}
            alt="Post media"
            className="feed-media-image"
          />
        </div>
      ) : null}

      {post.media_url && post.media_type === "video" ? (
        <div className="feed-media-wrap">
          <video className="feed-media-video" controls>
            <source src={resolveMediaUrl(post.media_url)} />
          </video>
        </div>
      ) : null}
    </article>
  );
}

function ProfileJournalCard({ journal }) {
  return (
    <article className="glass-card profile-content-card">
      <div className="profile-content-card-head">
        <div>
          <h3 className="profile-content-title">{journal.title || "Untitled Journal"}</h3>
          <p className="feed-subtitle">{formatEntryDate(journal.entry_date)}</p>
        </div>

        {journal.visibility ? (
          <span className="tag-pill">
            {journal.visibility}
          </span>
        ) : null}
      </div>

      <p className="profile-journal-body">
        {journal.content || "No journal content."}
      </p>
    </article>
  );
}

export default function PublicProfile() {
  const { userId } = useParams();

  const [profile, setProfile] = useState(null);
  const [posts, setPosts] = useState([]);
  const [journals, setJournals] = useState([]);

  const [loadingProfile, setLoadingProfile] = useState(true);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [loadingJournals, setLoadingJournals] = useState(true);

  const [error, setError] = useState("");
  const [friendActionLoading, setFriendActionLoading] = useState(false);
  const [friendActionState, setFriendActionState] = useState("idle");

  useEffect(() => {
    let isMounted = true;

    setLoadingProfile(true);
    setError("");

    api
      .get(`/users/${userId}`)
      .then((res) => {
        if (isMounted) {
          setProfile(res.data);
        }
      })
      .catch(() => {
        if (isMounted) setError("Failed to load profile.");
      })
      .finally(() => {
        if (isMounted) setLoadingProfile(false);
      });

    return () => {
      isMounted = false;
    };
  }, [userId]);

  useEffect(() => {
    let isMounted = true;

    setLoadingPosts(true);

    api
      .get(`/users/${userId}/posts`)
      .then((res) => {
        if (isMounted) {
          setPosts(res.data || []);
        }
      })
      .catch(() => {
        if (isMounted) {
          setPosts([]);
        }
      })
      .finally(() => {
        if (isMounted) setLoadingPosts(false);
      });

    return () => {
      isMounted = false;
    };
  }, [userId]);

  useEffect(() => {
    let isMounted = true;

    setLoadingJournals(true);

    api
      .get(`/users/${userId}/journals`)
      .then((res) => {
        if (isMounted) {
          setJournals(res.data || []);
        }
      })
      .catch(() => {
        if (isMounted) {
          setJournals([]);
        }
      })
      .finally(() => {
        if (isMounted) setLoadingJournals(false);
      });

    return () => {
      isMounted = false;
    };
  }, [userId]);

  async function sendFriendRequest() {
    try {
      setFriendActionLoading(true);
      await api.post(`/friend-requests/${userId}`);
      setFriendActionState("sent");
    } catch {
      setFriendActionState("sent");
    } finally {
      setFriendActionLoading(false);
    }
  }

  const displayName = useMemo(() => getDisplayName(profile), [profile]);

  if (loadingProfile) {
    return (
      <div className="fade-in">
        <h2 className="page-title">Profile</h2>
        <section className="glass-card">
          <p>Loading profile...</p>
        </section>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="fade-in">
        <h2 className="page-title">Profile</h2>
        <p className="error-text">{error || "Profile not found."}</p>
      </div>
    );
  }

  return (
    <div className="fade-in">
      <section className="glass-card public-profile-card public-profile-hero">
        <div className="public-profile-header">
          <ProfileAvatar profile={profile} />

          <div className="public-profile-meta">
            <h2 className="page-title">{displayName}</h2>
            <p className="page-subtitle">
              {profile.status_text || "No status added yet."}
            </p>

            <div className="public-profile-badges">
              {profile.age_range ? <span className="tag-pill">{profile.age_range}</span> : null}
              {profile.fitness_level ? <span className="tag-pill">{profile.fitness_level}</span> : null}
            </div>
          </div>

          <div className="public-profile-actions">
            <button
              type="button"
              className="btn btn-primary"
              disabled={friendActionLoading || friendActionState === "sent"}
              onClick={sendFriendRequest}
            >
              {friendActionLoading
                ? "Sending..."
                : friendActionState === "sent"
                ? "Request Sent"
                : "Add Friend"}
            </button>
          </div>
        </div>
      </section>

      <div className="profile-page-grid">
        <section className="profile-column-main">
          <div className="profile-section-head">
            <h3 className="section-title">Posts</h3>
          </div>

          {loadingPosts ? (
            <section className="glass-card">
              <p>Loading posts...</p>
            </section>
          ) : posts.length === 0 ? (
            <section className="glass-card">
              <p>No posts shared yet.</p>
            </section>
          ) : (
            <div className="profile-content-stack">
              {posts.map((post) => (
                <ProfilePostCard key={post.id} post={post} />
              ))}
            </div>
          )}
        </section>

        <aside className="profile-column-side">
          <div className="profile-section-head">
            <h3 className="section-title">Public Journals</h3>
          </div>

          {loadingJournals ? (
            <section className="glass-card">
              <p>Loading journals...</p>
            </section>
          ) : journals.length === 0 ? (
            <section className="glass-card">
              <p>No public journals yet.</p>
            </section>
          ) : (
            <div className="profile-content-stack">
              {journals.map((journal) => (
                <ProfileJournalCard key={journal.id} journal={journal} />
              ))}
            </div>
          )}
        </aside>
      </div>

      <div className="profile-back-link-wrap">
        <Link to="/app/feed" className="feed-author-link">
          Back to Feed
        </Link>
      </div>
    </div>
  );
}