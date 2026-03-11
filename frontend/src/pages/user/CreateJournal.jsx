import { useState } from "react";
import api from "../../api/client";
import CustomSelect from "../../components/CustomSelect";
import RewriteAssistBox from "../../components/RewriteAssistBox";

export default function CreateJournal() {
  const [entryDate, setEntryDate] = useState("");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [finalContent, setFinalContent] = useState("");
  const [visibility, setVisibility] = useState("private");

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  function handleUseRewrite(rewriteText) {
    if (!rewriteText) return;

    setContent(rewriteText);
    setFinalContent("");
  }

  async function submitJournal(e) {
    e.preventDefault();

    const contentToSubmit = (finalContent || content).trim();

    if (!contentToSubmit) {
      setError("Journal content is required.");
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
        visibility,
      };

      await api.post("/journals", payload);

      setMessage("Journal created successfully.");
      setEntryDate("");
      setTitle("");
      setContent("");
      setFinalContent("");
      setVisibility("private");
    } catch {
      setError("Failed to create journal.");
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
                  onChange={(e) => setContent(e.target.value)}
                />
              </div>

              <RewriteAssistBox
                text={content}
                onUseRewrite={handleUseRewrite}
                label="Journal AI Rewrite"
              />

              <div className="field">
                <label>Manual / Final Version</label>
                <textarea
                  rows="8"
                  placeholder="Use the AI suggestion here or manually refine your final version..."
                  value={finalContent}
                  onChange={(e) => setFinalContent(e.target.value)}
                />
              </div>

              <div className="journal-helper-note">
                <p className="feed-meta">
                  When you submit, the final version will be used if provided. Otherwise,
                  the original journal content will be saved.
                </p>
              </div>
            </div>
          </div>

          <div className="create-journal-submit-row">
            <button className="btn btn-primary" type="submit" disabled={loading}>
              {loading ? "Saving..." : "Create Journal"}
            </button>
          </div>
        </form>

        {message ? <p className="success-text">{message}</p> : null}
        {error ? <p className="error-text">{error}</p> : null}
      </section>
    </div>
  );
}