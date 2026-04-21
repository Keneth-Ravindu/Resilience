import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
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
        className="public-profile-avatar premium-publicprofile-avatar"
      />
    );
  }

  return (
    <div className="public-profile-avatar public-profile-avatar-fallback premium-publicprofile-avatar">
      {displayName.charAt(0).toUpperCase()}
    </div>
  );
}

function ProfilePostCard({ post }) {
  return (
    <article className="glass-card profile-content-card premium-publicprofile-content-card">
      <div className="profile-content-card-head premium-publicprofile-card-head">
        <div>
          <div className="premium-publicprofile-card-label">Post</div>
          <h3 className="profile-content-title">Shared update</h3>
          <p className="feed-subtitle">{formatDate(post.created_at)}</p>
        </div>
      </div>

      <p className="community-post-body premium-publicprofile-body">
        {post.content || "No content"}
      </p>

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
        <div className="feed-media-wrap premium-publicprofile-media-wrap">
          <img
            src={resolveMediaUrl(post.media_url)}
            alt="Post media"
            className="feed-media-image"
          />
        </div>
      ) : null}

      {post.media_url && post.media_type === "video" ? (
        <div className="feed-media-wrap premium-publicprofile-media-wrap">
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
    <article className="glass-card profile-content-card premium-publicprofile-content-card">
      <div className="profile-content-card-head premium-publicprofile-card-head">
        <div>
          <div className="premium-publicprofile-card-label">Journal</div>
          <h3 className="profile-content-title">
            {journal.title || "Untitled Journal"}
          </h3>
          <p className="feed-subtitle">{formatEntryDate(journal.entry_date)}</p>
        </div>

        {journal.visibility ? (
          <span className="tag-pill">{journal.visibility}</span>
        ) : null}
      </div>

      <p className="profile-journal-body premium-publicprofile-body">
        {journal.content || "No journal content."}
      </p>
    </article>
  );
}

export default function PublicProfile() {
  const { userId } = useParams();
  const navigate = useNavigate();

  const [profile, setProfile] = useState(null);
  const [posts, setPosts] = useState([]);
  const [journals, setJournals] = useState([]);

  const [loadingProfile, setLoadingProfile] = useState(true);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [loadingJournals, setLoadingJournals] = useState(true);

  const [error, setError] = useState("");
  const [friendActionLoading, setFriendActionLoading] = useState(false);
  const [friendActionState, setFriendActionState] = useState("loading");
  const [friendRequestId, setFriendRequestId] = useState(null);

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

  useEffect(() => {
    let isMounted = true;

    setFriendActionState("loading");
    setFriendRequestId(null);

    api
      .get(`/friend-requests/status/${userId}`)
      .then((res) => {
        if (!isMounted) return;

        setFriendActionState(res.data?.status || "none");
        setFriendRequestId(res.data?.request_id || null);
      })
      .catch(() => {
        if (!isMounted) return;
        setFriendActionState("none");
        setFriendRequestId(null);
      });

    return () => {
      isMounted = false;
    };
  }, [userId]);

  function openChat() {
    navigate(`/app/chat?userId=${userId}`);
  }

  async function sendFriendRequest() {
    try {
      setFriendActionLoading(true);
      setError("");

      const res = await api.post(`/friend-requests/${userId}`);
      setFriendActionState("pending_sent");
      setFriendRequestId(res.data?.id || null);
    } catch (err) {
      const detail = err?.response?.data?.detail;

      if (detail === "Request already sent") {
        setFriendActionState("pending_sent");
      } else {
        setError("Failed to send friend request.");
      }
    } finally {
      setFriendActionLoading(false);
    }
  }

  async function acceptFriendRequest() {
    if (!friendRequestId) return;

    try {
      setFriendActionLoading(true);
      setError("");

      await api.post(`/friend-requests/${friendRequestId}/accept`);
      setFriendActionState("friends");
    } catch {
      setError("Failed to accept friend request.");
    } finally {
      setFriendActionLoading(false);
    }
  }

  async function rejectFriendRequest() {
    if (!friendRequestId) return;

    try {
      setFriendActionLoading(true);
      setError("");

      await api.post(`/friend-requests/${friendRequestId}/reject`);
      setFriendActionState("none");
      setFriendRequestId(null);
    } catch {
      setError("Failed to reject friend request.");
    } finally {
      setFriendActionLoading(false);
    }
  }

  const displayName = useMemo(() => getDisplayName(profile), [profile]);

  if (loadingProfile) {
    return (
      <div className="fade-in premium-publicprofile-page">
        <div className="glass-card premium-publicprofile-hero-shell">
          <div className="premium-publicprofile-hero-content">
            <span className="premium-publicprofile-eyebrow">Profile</span>
            <h2 className="page-title">Public Profile</h2>
            <p className="page-subtitle">Loading profile...</p>
          </div>
        </div>

        <section className="glass-card premium-publicprofile-empty-card">
          <p>Loading profile...</p>
        </section>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="fade-in premium-publicprofile-page">
        <div className="glass-card premium-publicprofile-hero-shell">
          <div className="premium-publicprofile-hero-content">
            <span className="premium-publicprofile-eyebrow">Profile</span>
            <h2 className="page-title">Public Profile</h2>
          </div>
        </div>

        <p className="error-text">{error || "Profile not found."}</p>
      </div>
    );
  }

  return (
    <div className="fade-in premium-publicprofile-page">
      <div className="glass-card premium-publicprofile-hero-shell">
        <div className="premium-publicprofile-hero-content">
          <span className="premium-publicprofile-eyebrow">Profile</span>
          <h2 className="page-title">Public Profile</h2>
          <p className="page-subtitle premium-publicprofile-subtitle">
            View public posts, journals, and connect with this user.
          </p>
        </div>
      </div>

      <section className="glass-card public-profile-card public-profile-hero premium-publicprofile-hero">
        <div className="public-profile-header premium-publicprofile-header">
          <ProfileAvatar profile={profile} />

          <div className="public-profile-meta premium-publicprofile-meta">
            <h2 className="page-title premium-publicprofile-name">
              {displayName}
            </h2>
            <p className="page-subtitle premium-publicprofile-status">
              {profile.status_text || "No status added yet."}
            </p>

            <div className="public-profile-badges premium-publicprofile-badges">
              {profile.age_range ? (
                <span className="tag-pill">{profile.age_range}</span>
              ) : null}
              {profile.fitness_level ? (
                <span className="tag-pill">{profile.fitness_level}</span>
              ) : null}
            </div>
          </div>

          <div className="public-profile-actions premium-publicprofile-actions">
            {friendActionState === "loading" ? (
              <button type="button" className="btn btn-secondary" disabled>
                Loading...
              </button>
            ) : friendActionState === "self" ? (
              <button type="button" className="btn btn-secondary" disabled>
                This is you
              </button>
            ) : friendActionState === "friends" ? (
              <div className="quick-actions premium-publicprofile-action-row">
                <button type="button" className="btn btn-secondary" disabled>
                  Friends
                </button>

                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={openChat}
                >
                  Message
                </button>
              </div>
            ) : friendActionState === "pending_sent" ? (
              <button type="button" className="btn btn-secondary" disabled>
                Request Sent
              </button>
            ) : friendActionState === "pending_received" ? (
              <div className="quick-actions premium-publicprofile-action-row">
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={acceptFriendRequest}
                  disabled={friendActionLoading}
                >
                  {friendActionLoading ? "Processing..." : "Accept Request"}
                </button>

                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={rejectFriendRequest}
                  disabled={friendActionLoading}
                >
                  Reject
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="btn btn-primary"
                disabled={friendActionLoading}
                onClick={sendFriendRequest}
              >
                {friendActionLoading ? "Sending..." : "Add Friend"}
              </button>
            )}
          </div>
        </div>
      </section>

      <div className="profile-page-grid premium-publicprofile-grid">
        <section className="profile-column-main premium-publicprofile-column">
          <div className="profile-section-head premium-publicprofile-section-head">
            <h3 className="section-title">Posts</h3>
            <span className="premium-publicprofile-count">{posts.length}</span>
          </div>

          {loadingPosts ? (
            <section className="glass-card premium-publicprofile-empty-card">
              <p>Loading posts...</p>
            </section>
          ) : posts.length === 0 ? (
            <section className="glass-card premium-publicprofile-empty-card">
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

        <aside className="profile-column-side premium-publicprofile-column">
          <div className="profile-section-head premium-publicprofile-section-head">
            <h3 className="section-title">Public Journals</h3>
            <span className="premium-publicprofile-count">{journals.length}</span>
          </div>

          {loadingJournals ? (
            <section className="glass-card premium-publicprofile-empty-card">
              <p>Loading journals...</p>
            </section>
          ) : journals.length === 0 ? (
            <section className="glass-card premium-publicprofile-empty-card">
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

      <div className="profile-back-link-wrap premium-publicprofile-back-wrap">
        <Link to="/app/feed" className="premium-publicprofile-back-link">
          ← Back to Feed
        </Link>
      </div>
    </div>
  );
}