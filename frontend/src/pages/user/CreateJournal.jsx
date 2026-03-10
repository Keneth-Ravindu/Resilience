import { useState } from "react";
import api from "../../api/client";

export default function CreateJournal() {
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const submitJournal = async (e) => {
    e.preventDefault();

    try {
      setLoading(true);
      setError("");
      setMessage("");

      await api.post("/journals", { content });

      setMessage("Journal created successfully.");
      setContent("");
    } catch {
      setError("Failed to create journal.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fade-in">
      <h2 className="page-title">Create Journal</h2>

      <section className="glass-card form-card">
        <form onSubmit={submitJournal} className="form-stack">
          <div className="field">
            <label>Journal Content</label>
            <textarea
              rows="10"
              placeholder="Write your journal entry..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
            />
          </div>

          <button className="btn btn-primary" type="submit" disabled={loading}>
            {loading ? "Saving..." : "Create Journal"}
          </button>
        </form>

        {message ? <p className="success-text">{message}</p> : null}
        {error ? <p className="error-text">{error}</p> : null}
      </section>
    </div>
  );
}