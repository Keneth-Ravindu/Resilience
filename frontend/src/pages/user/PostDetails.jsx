import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import api from "../../api/client";

const API_BASE_URL = "http://127.0.0.1:8000";

function resolveMediaUrl(url) {
  if (!url) return null;
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  return `${API_BASE_URL}${url}`;
}

function getDisplayName(author) {
  if (!author) return "Unknown User";
  return author.display_name || author.name || `User #${author.id}`;
}

function getInitials(author) {
  const name = getDisplayName(author);
  return name.charAt(0).toUpperCase();
}

function formatDate(dateValue) {
  if (!dateValue) return "";
  return new Date(dateValue).toLocaleString();
}

export default function PostDetails() {
  const { postId } = useParams();

  const [post, setPost] = useState(null);
  const [comments, setComments] = useState([]);
  const [commentContent, setCommentContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [submittingComment, setSubmittingComment] = useState(false);
  const [error, setError] = useState("");

  async function loadPostDetails() {
    try {
      setLoading(true);
      setError("");

      const [postRes, commentsRes] = await Promise.all([
        api.get(`/posts/${postId}`),
        api.get(`/posts/${postId}/comments`),
      ]);

      setPost(postRes.data || null);
      setComments(commentsRes.data || []);
    } catch (err) {
      const detail = err?.response?.data?.detail;
      setError(typeof detail === "string" ? detail : "Failed to load post.");
      setPost(null);
      setComments([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (postId) {
      loadPostDetails();
    }
  }, [postId]);

  async function handleAddComment(e) {
    e.preventDefault();

    const cleaned = commentContent.trim();
    if (!cleaned) return;

    try {
      setSubmittingComment(true);
      setError("");

      await api.post(`/comments/posts/${postId}`, {
        content: cleaned,
      });

      setCommentContent("");
      await loadPostDetails();
    } catch (err) {
      const detail = err?.response?.data?.detail;
      setError(typeof detail === "string" ? detail : "Failed to add comment.");
    } finally {
      setSubmittingComment(false);
    }
  }

  const authorName = useMemo(() => getDisplayName(post?.author), [post]);

  if (loading) {
    return (
      <div className="fade-in">
        <h2 className="page-title">Post</h2>
        <section className="glass-card">
          <p>Loading post...</p>
        </section>
      </div>
    );
  }

  if (error && !post) {
    return (
      <div className="fade-in">
        <h2 className="page-title">Post</h2>
        <p className="error-text">{error}</p>
      </div>
    );
  }

  if (!post) {
    return (
      <div className="fade-in">
        <h2 className="page-title">Post</h2>
        <p className="error-text">Post not found.</p>
      </div>
    );
  }

  return (
    <div className="fade-in">
      <div className="dashboard-head">
        <div>
          <h2 className="page-title">Post Details</h2>
          <p className="page-subtitle">View the full post and discussion.</p>
        </div>
      </div>

      {error ? <p className="error-text">{error}</p> : null}

      <article className="glass-card community-post-card modern-post-card">
        <div className="community-post-head modern-post-head">
          <div className="community-post-author-wrap">
            <Link to={`/app/profile/${post.author?.id}`} className="feed-author-link">
              {post.author?.profile_picture_url ? (
                <img
                  src={resolveMediaUrl(post.author.profile_picture_url)}
                  alt={authorName}
                  className="feed-avatar"
                />
              ) : (
                <div className="feed-avatar feed-avatar-fallback">
                  {getInitials(post.author)}
                </div>
              )}
            </Link>

            <div>
              <Link to={`/app/profile/${post.author?.id}`} className="feed-author-link">
                <h3 className="community-post-author-name">{authorName}</h3>
              </Link>
              <div className="post-meta-inline">
                <span className="feed-meta">{formatDate(post.created_at)}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="community-post-body modern-post-body">
          <p className="feed-body">{post.content || "No content."}</p>
        </div>

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

      <section className="glass-card comment-section modern-comment-section">
        <div className="comment-section-head">
          <h3>Comments</h3>
        </div>

        <form onSubmit={handleAddComment} className="form-stack modern-comment-form">
          <div className="field">
            <textarea
              rows="3"
              placeholder="Write a comment..."
              value={commentContent}
              onChange={(e) => setCommentContent(e.target.value)}
            />
          </div>

          <div className="quick-actions">
            <button
              type="submit"
              className="btn btn-primary btn-sm"
              disabled={submittingComment}
            >
              {submittingComment ? "Posting..." : "Post Comment"}
            </button>
          </div>
        </form>

        <div className="comment-list">
          {comments.length === 0 ? (
            <p className="feed-meta">No comments yet.</p>
          ) : (
            comments.map((comment) => {
              const commentAuthorName = getDisplayName(comment.author);

              return (
                <article key={comment.id} className="comment-card modern-comment-card">
                  <div className="comment-meta">
                    <div className="comment-author-wrap">
                      <Link
                        to={`/app/profile/${comment.author?.id}`}
                        className="feed-author-link"
                      >
                        {comment.author?.profile_picture_url ? (
                          <img
                            src={resolveMediaUrl(comment.author.profile_picture_url)}
                            alt={commentAuthorName}
                            className="feed-avatar feed-avatar-sm"
                          />
                        ) : (
                          <div className="feed-avatar feed-avatar-sm feed-avatar-fallback">
                            {getInitials(comment.author)}
                          </div>
                        )}
                      </Link>

                      <div>
                        <Link
                          to={`/app/profile/${comment.author?.id}`}
                          className="feed-author-link"
                        >
                          <strong className="comment-author-name">
                            {commentAuthorName}
                          </strong>
                        </Link>
                        <p className="feed-meta">{formatDate(comment.created_at)}</p>
                      </div>
                    </div>
                  </div>

                  <p className="comment-body">{comment.content}</p>
                </article>
              );
            })
          )}
        </div>
      </section>

      <div className="profile-back-link-wrap">
        <Link to="/app/feed" className="feed-author-link">
          Back to Feed
        </Link>
      </div>
    </div>
  );
}