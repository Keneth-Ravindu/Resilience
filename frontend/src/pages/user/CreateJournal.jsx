import { useState } from "react";
import api from "../../api/client";
import BlockedContentModal from "../../components/BlockedContentModal";
import CustomSelect from "../../components/CustomSelect";
import RewriteAssistBox from "../../components/RewriteAssistBox";

export default function CreateJournal() {
  const [entryDate, setEntryDate] = useState("");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [finalContent, setFinalContent] = useState("");
  const [usedRewrite, setUsedRewrite] = useState(false);
  const [visibility, setVisibility] = useState("private");

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [moderationResult, setModerationResult] = useState(null);
  const [checkingModeration, setCheckingModeration] = useState(false);
  const [blockedModalOpen, setBlockedModalOpen] = useState(false);

  function showBlockedModal(result) {
    setModerationResult(result || null);
    setBlockedModalOpen(true);
  }

  function handleUseRewrite(rewriteText) {
    if (!rewriteText) return;

    setContent(rewriteText);
    setFinalContent(rewriteText);
    setUsedRewrite(true);
    setModerationResult(null);
    setBlockedModalOpen(false);
    setError("");
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

  async function submitJournal(e) {
    e.preventDefault();
    setModerationResult(null);

    const contentToSubmit = (finalContent || content).trim();

    if (!contentToSubmit) {
      setError("Journal content is required.");
      return;
    }

    const moderation = await checkModeration(contentToSubmit);

    if (moderation?.is_toxic) {
      setError("");
      showBlockedModal({
        is_toxic: true,
        message:
          moderation.message ||
          "This journal is too harsh or toxic. Please use the rewrite suggestion or rewrite it in a more respectful way before posting.",
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
        entry_date: entryDate || null,
        title: title || null,
        content: contentToSubmit,
        used_rewrite: usedRewrite,
        visibility,
      };

      await api.post("/journals", payload);

      setMessage("Journal created successfully.");
      setEntryDate("");
      setTitle("");
      setContent("");
      setFinalContent("");
      setVisibility("private");
      setModerationResult(null);
      setBlockedModalOpen(false);
      setUsedRewrite(false);
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
        setError("Failed to create journal.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fade-in">
      <div className="page-head-with-actions">
        <div>
          <h2 className="page-title">Create Journal</h2>
          <p className="page-subtitle">
            Capture reflections, mindset, emotional patterns, and progress.
          </p>
        </div>
      </div>

      <section className="glass-card form-card">
        <form onSubmit={submitJournal} className="form-stack">
          <div className="create-journal-grid">
            <div className="create-journal-main">
              <div className="field">
                <label>Entry Date</label>
                <input
                  type="date"
                  value={entryDate}
                  onChange={(e) => setEntryDate(e.target.value)}
                />
              </div>

              <div className="field">
                <label>Title</label>
                <input
                  type="text"
                  placeholder="e.g. Push day reflections"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>

              <div className="field">
                <CustomSelect
                  label="Visibility"
                  value={visibility}
                  onChange={setVisibility}
                  options={[
                    { value: "private", label: "Private" },
                    { value: "public", label: "Public" },
                  ]}
                />
              </div>

              <div className="field">
                <label>Original Journal Content</label>
                <textarea
                  rows="10"
                  placeholder="Write your journal entry..."
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
                label="Journal AI Rewrite"
                autoTrigger={moderationResult?.is_toxic}
              />

              <div className="field">
                <label>Manual / Final Version</label>
                <textarea
                  rows="8"
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
                  Otherwise, the original journal content will be saved.
                </p>
              </div>
            </div>
          </div>

          <div className="create-journal-submit-row">
            <button
              className="btn btn-primary"
              type="submit"
              disabled={loading || checkingModeration}
            >
              {checkingModeration
                ? "Checking..."
                : loading
                ? "Saving..."
                : "Create Journal"}
            </button>
          </div>
        </form>

        {message ? <p className="success-text">{message}</p> : null}
        {error ? <p className="error-text">{error}</p> : null}
      </section>

      <BlockedContentModal
        open={blockedModalOpen}
        onClose={() => setBlockedModalOpen(false)}
        title="Journal Blocked"
        message={moderationResult?.message}
        toxicityLabel={moderationResult?.toxicity_label}
        primaryEmotion={moderationResult?.primary_emotion}
      />
    </div>
  );
}