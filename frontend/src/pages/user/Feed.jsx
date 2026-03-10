import { useEffect, useState } from "react";
import api from "../../api/client";

function MediaPreview({ mediaUrl, mediaType }) {
  if (!mediaUrl || !mediaType) return null;

  if (mediaType === "image") {
    return (
      <div className="feed-media-wrap">
        <img src={mediaUrl} alt="Post media" className="feed-media-image" />
      </div>
    );
  }

  if (mediaType === "video") {
    return (
      <div className="feed-media-wrap">
        <video className="feed-media-video" controls>
          <source src={mediaUrl} />
          Your browser does not support video playback.
        </video>
      </div>
    );
  }

  return null;
}

function CommentSection({ postId }) {
  const [comments, setComments] = useState([]);
  const [content, setContent] = useState("");
  const [loadingComments, setLoadingComments] = useState(true);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState("");

  const loadComments = async () => {
    try {
      setLoadingComments(true);
      const res = await api.get(`/posts/${postId}/comments`);
      setComments(res.data || []);
    } catch {
      setError("Failed to load comments.");
    } finally {
      setLoadingComments(false);
    }
  };

  useEffect(() => {
    loadComments();
  }, [postId]);

  const submitComment = async (e) => {
    e.preventDefault();
    if (!content.trim()) return;

    try {
      setPosting(true);
      setError("");

      await api.post(`/posts/${postId}/comments`, {
        content: content.trim(),
      });

      setContent("");
      await loadComments();
    } catch {
      setError("Failed to post comment.");
    } finally {
      setPosting(false);
    }
  };

  return (
    <div className="comment-section">
      <div className="comment-section-head">
        <h4>Comments</h4>
        <span>{comments.length}</span>
      </div>

      {loadingComments ? (
        <p className="feed-meta">Loading comments...</p>
      ) : comments.length === 0 ? (
        <p className="feed-meta">No comments yet.</p>
      ) : (
        <div className="comment-list">
          {comments.map((comment) => (
            <div className="comment-card" key={comment.id}>
              <p className="comment-body">{comment.content}</p>
              <div className="comment-meta">
                <span>User #{comment.user_id}</span>
                <span>
                  {comment.created_at
                    ? new Date(comment.created_at).toLocaleString()
                    : "N/A"}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      <form onSubmit={submitComment} className="comment-form">
        <textarea
          rows="3"
          placeholder="Write a comment..."
          value={content}
          onChange={(e) => setContent(e.target.value)}
        />
        <button className="btn btn-primary btn-sm" type="submit" disabled={posting}>
          {posting ? "Posting..." : "Add Comment"}
        </button>
      </form>

      {error ? <p className="error-text">{error}</p> : null}
    </div>
  );
}

export default function Feed() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadPosts = async () => {
    try {
      setLoading(true);
      setError("");
      const res = await api.get("/posts");
      setPosts(res.data || []);
    } catch {
      setError("Failed to load posts.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPosts();
  }, []);

  if (loading) {
    return (
      <div className="fade-in">
        <h2 className="page-title">Feed</h2>
        <section className="glass-card">
          <p>Loading posts...</p>
        </section>
      </div>
    );
  }

  if (error) {
    return (
      <div className="fade-in">
        <h2 className="page-title">Feed</h2>
        <p className="error-text">{error}</p>
      </div>
    );
  }

  return (
    <div className="fade-in">
      <div className="page-head-with-actions">
        <div>
          <h2 className="page-title">Community Feed</h2>
          <p className="page-subtitle">
            Workout posts, gym progress, and community discussion.
          </p>
        </div>
      </div>

      {posts.length === 0 ? (
        <section className="glass-card">
          <p>No posts yet.</p>
        </section>
      ) : (
        <div className="feed-stack">
          {posts.map((post) => (
            <section className="glass-card community-post-card" key={post.id}>
              <div className="community-post-head">
                <div>
                  <h3>Post #{post.id}</h3>
                  <p className="feed-subtitle">User #{post.user_id}</p>
                </div>

                <div className="community-post-meta">
                  <span>
                    {post.created_at
                      ? new Date(post.created_at).toLocaleString()
                      : "N/A"}
                  </span>
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

              <MediaPreview mediaUrl={post.media_url} mediaType={post.media_type} />

              <CommentSection postId={post.id} />
            </section>
          ))}
        </div>
      )}
    </div>
  );
}