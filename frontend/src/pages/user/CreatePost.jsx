import { useMemo, useState } from "react";
import api from "../../api/client";
import BlockedContentModal from "../../components/BlockedContentModal";
import RewriteAssistBox from "../../components/RewriteAssistBox";

export default function CreatePost() {
  const [content, setContent] = useState("");
  const [finalContent, setFinalContent] = useState("");
  const [usedRewrite, setUsedRewrite] = useState(false);
  const [tags, setTags] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadedMediaUrl, setUploadedMediaUrl] = useState("");
  const [uploadedMediaType, setUploadedMediaType] = useState("");

  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [moderationResult, setModerationResult] = useState(null);
  const [checkingModeration, setCheckingModeration] = useState(false);
  const [blockedModalOpen, setBlockedModalOpen] = useState(false);

  const previewUrl = useMemo(() => {
    if (!selectedFile) return null;
    return URL.createObjectURL(selectedFile);
  }, [selectedFile]);

  function handleUseRewrite(rewriteText) {
    if (!rewriteText) return;

    setContent(rewriteText);
    setFinalContent(rewriteText);
    setUsedRewrite(true); 
    setModerationResult(null);
    setBlockedModalOpen(false);
    setError("");
  }

  function showBlockedModal(result) {
    setModerationResult(result || null);
    setBlockedModalOpen(true);
  }

  const handleFileChange = (e) => {
    const file = e.target.files?.[0] || null;
    setSelectedFile(file);
    setUploadedMediaUrl("");
    setUploadedMediaType("");
    setMessage("");
    setError("");
  };

  const uploadMedia = async () => {
    if (!selectedFile) return;

    try {
      setUploadingMedia(true);
      setError("");
      setMessage("");

      const formData = new FormData();
      formData.append("file", selectedFile);

      const res = await api.post("/posts/upload-media", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      setUploadedMediaUrl(res.data.media_url || "");
      setUploadedMediaType(res.data.media_type || "");
      setMessage("Media uploaded successfully.");
    } catch {
      setError("Failed to upload media.");
    } finally {
      setUploadingMedia(false);
    }
  };

  const removeSelectedMedia = () => {
    setSelectedFile(null);
    setUploadedMediaUrl("");
    setUploadedMediaType("");
    setMessage("");
    setError("");
  };

  const checkModeration = async (textToCheck) => {
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
  };

  const submitPost = async (e) => {
    e.preventDefault();
    setModerationResult(null);

    const contentToSubmit = (finalContent || content).trim();

    if (!contentToSubmit) {
      setError("Post content is required.");
      return;
    }

    const moderation = await checkModeration(contentToSubmit);

    if (moderation?.is_toxic) {
      setError("");
      showBlockedModal({
        is_toxic: true,
        message:
          moderation.message ||
          "This post is too harsh or toxic. Please use the rewrite suggestion or rewrite it in a more respectful way before posting.",
        toxicity_label: moderation.toxicity_label,
        primary_emotion: moderation.primary_emotion,
      });
      return;
    }

    try {
      setLoading(true);
      setError("");
      setMessage("");

      const payload = {
        content: contentToSubmit,
        used_rewrite: usedRewrite,
        tags: tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
        media_url: uploadedMediaUrl || null,
        media_type: uploadedMediaType || null,
      };

      await api.post("/posts", payload);

      setMessage("Post created successfully.");
      setContent("");
      setFinalContent("");
      setTags("");
      setUsedRewrite(false);
      setSelectedFile(null);
      setUploadedMediaUrl("");
      setUploadedMediaType("");
      setModerationResult(null);
      setBlockedModalOpen(false);
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
        setError("Failed to create post.");
      }
    } finally {
      setLoading(false);
    }
  };

  const selectedFileName = selectedFile?.name || "No file selected";

  return (
    <div className="fade-in create-post-page">
      <div className="page-head-with-actions">
        <div>
          <h2 className="page-title">Create Post</h2>
          <p className="page-subtitle">
            Share your gym progress, thoughts, achievements, or motivation.
          </p>
        </div>
      </div>

      <section className="glass-card create-post-card">
        <form onSubmit={submitPost} className="form-stack">
          <div className="create-post-grid">
            <div className="create-post-main">
              <div className="field">
                <label>Original Post Content</label>
                <textarea
                  rows="8"
                  placeholder="Share your workout, progress, or thoughts..."
                  value={content}
                  onChange={(e) => {
                    setContent(e.target.value);
                    setUsedRewrite(false);
                    setModerationResult(null);
                    setError("");
                  }}
                />
              </div>

              <RewriteAssistBox
                text={content}
                onUseRewrite={handleUseRewrite}
                label="Post AI Rewrite"
                autoTrigger={moderationResult?.is_toxic}
              />

              <div className="field">
                <label>Manual / Final Version</label>
                <textarea
                  rows="6"
                  placeholder="Use the AI suggestion here or manually refine your final version..."
                  value={finalContent}
                  onChange={(e) => {
                    setFinalContent(e.target.value);
                    setUsedRewrite(false);
                    setModerationResult(null);
                    setError("");
                  }}
                />
              </div>

              <div className="journal-helper-note">
                <p className="feed-meta">
                  When you submit, the final version will be used if provided.
                  Otherwise, the original post content will be saved.
                </p>
              </div>

              <div className="field">
                <label>Tags (comma separated)</label>
                <input
                  type="text"
                  placeholder="e.g. chest, progress, motivation"
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                />
              </div>
            </div>

            <aside className="create-post-side">
              <section className="create-post-upload-box">
                <div className="section-head">
                  <h3>Media</h3>
                  <p className="feed-subtitle">
                    Add one image or video to make your post more engaging.
                  </p>
                </div>

                <label className="create-post-file-label">
                  <input
                    type="file"
                    accept="image/*,video/mp4,video/webm,video/quicktime"
                    onChange={handleFileChange}
                    className="create-post-file-input"
                  />
                  <span className="create-post-file-button">Choose File</span>
                  <span className="create-post-file-name">
                    {selectedFileName}
                  </span>
                </label>

                {selectedFile ? (
                  <div className="create-post-preview-card">
                    {selectedFile.type.startsWith("image/") ? (
                      <img
                        src={previewUrl}
                        alt="Preview"
                        className="feed-media-image"
                      />
                    ) : selectedFile.type.startsWith("video/") ? (
                      <video className="feed-media-video" controls>
                        <source src={previewUrl} />
                      </video>
                    ) : null}
                  </div>
                ) : (
                  <div className="create-post-empty-preview">
                    <span>No media selected yet.</span>
                  </div>
                )}

                <div className="create-post-action-row">
                  <button
                    className="btn btn-secondary"
                    type="button"
                    onClick={uploadMedia}
                    disabled={!selectedFile || uploadingMedia}
                  >
                    {uploadingMedia ? "Uploading..." : "Upload Media"}
                  </button>

                  {selectedFile ? (
                    <button
                      className="btn btn-ghost"
                      type="button"
                      onClick={removeSelectedMedia}
                    >
                      Remove
                    </button>
                  ) : null}
                </div>

                {uploadedMediaUrl ? (
                  <p className="success-text">Media ready for post.</p>
                ) : null}
              </section>
            </aside>
          </div>

          <div className="create-post-submit-row">
            <button
              className="btn btn-primary create-post-submit-btn"
              type="submit"
              disabled={loading || checkingModeration}
            >
              {checkingModeration
                ? "Checking..."
                : loading
                ? "Posting..."
                : "Create Post"}
            </button>
          </div>
        </form>

        {message ? <p className="success-text">{message}</p> : null}
        {error ? <p className="error-text">{error}</p> : null}
      </section>

      <BlockedContentModal
        open={blockedModalOpen}
        onClose={() => setBlockedModalOpen(false)}
        title="Post Blocked"
        message={moderationResult?.message}
        toxicityLabel={moderationResult?.toxicity_label}
        primaryEmotion={moderationResult?.primary_emotion}
      />
    </div>
  );
}