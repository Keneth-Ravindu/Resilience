import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../api/client";
import BlockedContentModal from "../../components/BlockedContentModal";
import ReactionButton from "../../components/ReactionButton";
import RewriteAssistBox from "../../components/RewriteAssistBox";
import RewriteSuggestionCard from "../../components/RewriteSuggestionCard";

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
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function formatDate(dateValue) {
  if (!dateValue) return "N/A";
  const date = new Date(dateValue);
  return date.toLocaleString();
}

function formatRelativeTime(dateValue) {
  if (!dateValue) return "Just now";

  const diffMs = Date.now() - new Date(dateValue).getTime();
  const mins = Math.floor(diffMs / 60000);

  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m`;

  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;

  return new Date(dateValue).toLocaleDateString();
}

function Avatar({ author, size = "md" }) {
  const className =
    size === "sm" ? "feed-avatar feed-avatar-sm" : "feed-avatar";

  if (author?.profile_picture_url) {
    return (
      <img
        src={resolveMediaUrl(author.profile_picture_url)}
        alt={getDisplayName(author)}
        className={className}
      />
    );
  }

  return (
    <div className={`${className} feed-avatar-fallback`}>
      {getInitials(author)}
    </div>
  );
}

function MediaPreview({ mediaUrl, mediaType }) {
  if (!mediaUrl || !mediaType) return null;

  if (mediaType === "image") {
    return (
      <div className="feed-media-wrap">
        <img
          src={resolveMediaUrl(mediaUrl)}
          alt="Post media"
          className="feed-media-image"
        />
      </div>
    );
  }

  if (mediaType === "video") {
    return (
      <div className="feed-media-wrap">
        <video className="feed-media-video" controls>
          <source src={resolveMediaUrl(mediaUrl)} />
        </video>
      </div>
    );
  }

  return null;
}

function WorkoutSection({ workoutData }) {
  if (!workoutData || workoutData.length === 0) return null;

  return (
    <div className="workout-section">
      <p className="workout-title">💪 Workout Summary</p>

      <div className="workout-grid">
        {workoutData.map((exercise, idx) => (
          <div className="workout-card" key={`${exercise.name}-${idx}`}>
            <div className="workout-image-wrap">
              <img
                src={resolveMediaUrl(exercise.image)}
                alt={exercise.name}
                className="workout-image"
              />
            </div>

            <div className="workout-info">
              <p className="workout-name">{exercise.name.toUpperCase()}</p>
              <span className="workout-muscle">{exercise.muscle}</span>

              <div className="workout-metrics">
                {exercise.sets ? (
                  <span className="workout-metric-chip">
                    {exercise.sets} sets
                  </span>
                ) : null}

                {exercise.reps ? (
                  <span className="workout-metric-chip">
                    {exercise.reps} reps
                  </span>
                ) : null}

                {exercise.weight ? (
                  <span className="workout-metric-chip">
                    {exercise.weight}
                  </span>
                ) : null}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PostAnalysisSection({ postId }) {
  const [expanded, setExpanded] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [loadingAnalysis, setLoadingAnalysis] = useState(false);
  const [analysisError, setAnalysisError] = useState("");

  async function loadAnalysis() {
    try {
      setLoadingAnalysis(true);
      setAnalysisError("");

      const res = await api.get(`/posts/${postId}/analysis`);
      setAnalysis(res.data || null);
    } catch {
      setAnalysisError("No AI insight available for this post yet.");
    } finally {
      setLoadingAnalysis(false);
    }
  }

  async function toggleExpanded() {
    const next = !expanded;
    setExpanded(next);

    if (next && !analysis && !loadingAnalysis) {
      await loadAnalysis();
    }
  }

  return (
    <div className="journal-analysis-block">
      <div className="journal-analysis-actions">
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={toggleExpanded}
        >
          {expanded ? "Hide AI Insight" : "View AI Insight"}
        </button>
      </div>

      {expanded ? (
        <div className="journal-analysis-panel">
          {loadingAnalysis ? (
            <p className="feed-meta">Loading analysis...</p>
          ) : analysisError ? (
            <p className="feed-meta">{analysisError}</p>
          ) : analysis ? (
            <>
              <div className="journal-ai-summary">
                {analysis.primary_emotion ? (
                  <span className="tag-pill">
                    Emotion: {analysis.primary_emotion}
                  </span>
                ) : null}

                {analysis.toxicity_label ? (
                  <span className="tag-pill">
                    Tone: {analysis.toxicity_label}
                  </span>
                ) : null}
              </div>

              <RewriteSuggestionCard
                title="Post Rewrite Suggestion"
                rewriteSuggestion={analysis.rewrite_suggestion}
                rewriteReason={analysis.rewrite_reason}
                primaryEmotion={analysis.primary_emotion}
                toxicityLabel={analysis.toxicity_label}
                objectLabel="post"
              />
            </>
          ) : (
            <p className="feed-meta">No analysis available.</p>
          )}
        </div>
      ) : null}
    </div>
  );
}

function CommentAnalysisSection({ commentId }) {
  const [expanded, setExpanded] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [loadingAnalysis, setLoadingAnalysis] = useState(false);
  const [analysisError, setAnalysisError] = useState("");

  async function loadAnalysis() {
    try {
      setLoadingAnalysis(true);
      setAnalysisError("");

      const res = await api.get(`/comments/${commentId}/analysis`);
      setAnalysis(res.data || null);
    } catch {
      setAnalysisError("No AI insight available for this comment yet.");
    } finally {
      setLoadingAnalysis(false);
    }
  }

  async function toggleExpanded() {
    const next = !expanded;
    setExpanded(next);

    if (next && !analysis && !loadingAnalysis) {
      await loadAnalysis();
    }
  }

  return (
    <div className="journal-analysis-block comment-analysis-block">
      <div className="journal-analysis-actions">
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={toggleExpanded}
        >
          {expanded ? "Hide AI Insight" : "View AI Insight"}
        </button>
      </div>

      {expanded ? (
        <div className="journal-analysis-panel">
          {loadingAnalysis ? (
            <p className="feed-meta">Loading analysis...</p>
          ) : analysisError ? (
            <p className="feed-meta">{analysisError}</p>
          ) : analysis ? (
            <>
              <div className="journal-ai-summary">
                {analysis.primary_emotion ? (
                  <span className="tag-pill">
                    Emotion: {analysis.primary_emotion}
                  </span>
                ) : null}

                {analysis.toxicity_label ? (
                  <span className="tag-pill">
                    Tone: {analysis.toxicity_label}
                  </span>
                ) : null}
              </div>

              <RewriteSuggestionCard
                title="Comment Rewrite Suggestion"
                rewriteSuggestion={analysis.rewrite_suggestion}
                rewriteReason={analysis.rewrite_reason}
                primaryEmotion={analysis.primary_emotion}
                toxicityLabel={analysis.toxicity_label}
                objectLabel="comment"
              />
            </>
          ) : (
            <p className="feed-meta">No analysis available.</p>
          )}
        </div>
      ) : null}
    </div>
  );
}

function CommentSection({ postId }) {
  const [comments, setComments] = useState([]);
  const [commentInput, setCommentInput] = useState({
    content: "",
    finalContent: "",
    usedRewrite: false,
  });
  const [loadingComments, setLoadingComments] = useState(true);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState("");
  const [moderationResult, setModerationResult] = useState(null);
  const [checkingModeration, setCheckingModeration] = useState(false);
  const [blockedModalOpen, setBlockedModalOpen] = useState(false);

  const loadComments = async () => {
    try {
      setLoadingComments(true);

      const res = await api.get(`/posts/${postId}/comments`);
      setComments(res.data || []);
      setError("");
    } catch {
      setError("Failed to load comments.");
    } finally {
      setLoadingComments(false);
    }
  };

  useEffect(() => {
    loadComments();
  }, [postId]);

  function handleUseRewrite(rewriteText) {
    if (!rewriteText) return;

    setCommentInput((prev) => ({
      ...prev,
      finalContent: rewriteText,
      usedRewrite: true,
    }));
    setModerationResult(null);
    setBlockedModalOpen(false);
    setError("");
  }

  function showBlockedModal(result) {
    setModerationResult(result || null);
    setBlockedModalOpen(true);
  }

  async function checkModeration(textToCheck) {
    try {
      setCheckingModeration(true);

      const res = await api.post("/moderation/check-text", {
        text: textToCheck,
      });

      setModerationResult(res.data || null);
      return res.data || null;
    } catch {
      setModerationResult(null);
      return null;
    } finally {
      setCheckingModeration(false);
    }
  }

  const submitComment = async (e) => {
    e.preventDefault();
    setModerationResult(null);

    const contentToSubmit =
      commentInput.finalContent.trim().length > 0
        ? commentInput.finalContent.trim()
        : commentInput.content.trim();

    if (!contentToSubmit) return;

    const moderation = await checkModeration(contentToSubmit);

    if (moderation?.is_toxic) {
      setError("");
      showBlockedModal({
        is_toxic: true,
        message:
          moderation.message ||
          "This comment is too harsh or toxic. Please rewrite it in a more respectful way.",
        toxicity_label: moderation.toxicity_label,
        primary_emotion: moderation.primary_emotion,
      });
      return;
    }

    try {
      setPosting(true);
      setError("");

      await api.post(`/posts/${postId}/comments`, {
        content: contentToSubmit,
        used_rewrite: commentInput.usedRewrite,
      });

      setCommentInput({
        content: "",
        finalContent: "",
        usedRewrite: false,
      });
      setModerationResult(null);
      setBlockedModalOpen(false);
      await loadComments();
    } catch (err) {
      const backendError = err?.response?.data?.detail;

      if (backendError?.is_toxic) {
        const blockedResult = {
          is_toxic: true,
          message: backendError.message,
          toxicity_label: backendError.toxicity_label,
          primary_emotion: backendError.primary_emotion,
        };

        setError("");
        showBlockedModal(blockedResult);
      } else {
        setError("Failed to post comment.");
      }
    } finally {
      setPosting(false);
    }
  };

  return (
    <div className="comment-section modern-comment-section">
      <div className="comment-section-head">
        <h4>Comments</h4>
        <span>{comments.length}</span>
      </div>

      {loadingComments ? (
        <p className="feed-meta">Loading comments...</p>
      ) : comments.length === 0 ? (
        <p className="feed-meta">Be the first to comment.</p>
      ) : (
        <div className="comment-list">
          {comments.map((comment) => (
            <div className="comment-card modern-comment-card" key={comment.id}>
              <div className="comment-head">
                <div className="comment-author-wrap">
                  <Link
                    to={`/app/profile/${comment.author?.id || comment.user_id}`}
                    className="feed-author-link"
                  >
                    <Avatar author={comment.author} size="sm" />
                  </Link>

                  <div>
                    <Link
                      to={`/app/profile/${comment.author?.id || comment.user_id}`}
                      className="feed-author-link"
                    >
                      <p className="comment-author-name">
                        {getDisplayName(comment.author)}
                      </p>
                    </Link>

                    <p
                      className="comment-time"
                      title={formatDate(comment.created_at)}
                    >
                      {formatRelativeTime(comment.created_at)}
                    </p>
                  </div>
                </div>
              </div>

              <p className="comment-body">{comment.content}</p>

              <div className="comment-card-actions">
                <ReactionButton
                  objectType="comment"
                  objectId={comment.id}
                  counts={comment.reaction_counts}
                  onReact={loadComments}
                />
              </div>

              <CommentAnalysisSection commentId={comment.id} />
            </div>
          ))}
        </div>
      )}

      <form
        onSubmit={submitComment}
        className="comment-form modern-comment-form"
      >
        <textarea
          rows="2"
          placeholder="Write a supportive comment..."
          value={commentInput.content}
          onChange={(e) => {
            setCommentInput((prev) => ({
              ...prev,
              content: e.target.value,
              usedRewrite: false,
            }));
            setModerationResult(null);
            setError("");
          }}
        />

        <RewriteAssistBox
          text={commentInput.content}
          onUseRewrite={handleUseRewrite}
          label="Comment AI Rewrite"
          compact
          autoTrigger={moderationResult?.is_toxic}
        />

        <textarea
          rows="3"
          placeholder="Manual / final comment version..."
          value={commentInput.finalContent}
          onChange={(e) => {
            setCommentInput((prev) => ({
              ...prev,
              finalContent: e.target.value,
              usedRewrite: false,
            }));
            setModerationResult(null);
            setError("");
          }}
        />

        <button
          className="btn btn-primary btn-sm"
          type="submit"
          disabled={posting || checkingModeration}
        >
          {checkingModeration
            ? "Checking..."
            : posting
            ? "Posting..."
            : "Comment"}
        </button>
      </form>

      {error ? <p className="error-text">{error}</p> : null}

      <BlockedContentModal
        open={blockedModalOpen}
        onClose={() => setBlockedModalOpen(false)}
        title="Comment Blocked"
        message={moderationResult?.message}
        toxicityLabel={moderationResult?.toxicity_label}
        primaryEmotion={moderationResult?.primary_emotion}
      />
    </div>
  );
}

function FeedHeader() {
  return (
    <div className="feed-hero glass-card">
      <div>
        <h2 className="page-title">Community Feed</h2>

        <p className="page-subtitle">
          Share progress, motivation, wins, setbacks, and support from the
          community.
        </p>
      </div>
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

      const res = await api.get("/posts");
      setPosts(res.data || []);
      setError("");
    } catch {
      setError("Failed to load posts.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPosts();
  }, []);

  const emptyState = useMemo(
    () => (
      <section className="glass-card">
        <p>No posts yet.</p>
      </section>
    ),
    []
  );

  if (loading) {
    return (
      <div className="fade-in">
        <FeedHeader />

        <section className="glass-card">
          <p>Loading posts...</p>
        </section>
      </div>
    );
  }

  if (error) {
    return (
      <div className="fade-in">
        <FeedHeader />
        <p className="error-text">{error}</p>
      </div>
    );
  }

  return (
    <div className="fade-in">
      <FeedHeader />

      {posts.length === 0 ? (
        emptyState
      ) : (
        <div className="feed-stack modern-feed-stack">
          {posts.map((post) => (
            <section
              className="glass-card community-post-card modern-post-card"
              key={post.id}
            >
              <div className="community-post-head modern-post-head">
                <div className="community-post-author-wrap">
                  <Link
                    to={`/app/profile/${post.author?.id || post.user_id}`}
                    className="feed-author-link"
                  >
                    <Avatar author={post.author} />
                  </Link>

                  <div>
                    <Link
                      to={`/app/profile/${post.author?.id || post.user_id}`}
                      className="feed-author-link"
                    >
                      <h3 className="community-post-author-name">
                        {getDisplayName(post.author)}
                      </h3>
                    </Link>

                    <div className="post-meta-inline">
                      <span
                        className="feed-subtitle"
                        title={formatDate(post.created_at)}
                      >
                        {formatRelativeTime(post.created_at)}
                      </span>

                      <span className="post-meta-dot">•</span>

                      <span className="feed-subtitle">Post #{post.id}</span>

                      {post.workout_data?.length ? (
                        <>
                          <span className="post-meta-dot">•</span>
                          <span className="workout-post-badge">Workout Post</span>
                        </>
                      ) : null}
                    </div>
                  </div>
                </div>

                <button type="button" className="post-more-btn">
                  •••
                </button>
              </div>

              <p className="community-post-body modern-post-body">
                {post.content || "No content"}
              </p>

              {post.tags?.length ? (
                <div className="tag-row">
                  {post.tags.map((tag, idx) => (
                    <span
                      className="tag-pill"
                      key={`${post.id}-${tag}-${idx}`}
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              ) : null}

              <MediaPreview
                mediaUrl={post.media_url}
                mediaType={post.media_type}
              />

              {post.workout_data?.length ? (
                <div className="workout-post-highlight">
                  <p className="workout-post-highlight-text">
                    Structured workout detected from this post
                  </p>
                  <WorkoutSection workoutData={post.workout_data} />
                </div>
              ) : null}

              <ReactionButton
                objectType="post"
                objectId={post.id}
                counts={post.reaction_counts}
                onReact={loadPosts}
              />

              <PostAnalysisSection postId={post.id} />

              <CommentSection postId={post.id} />
            </section>
          ))}
        </div>
      )}
    </div>
  );
}