import { useState } from "react";
import api from "../../api/client";

export default function CreatePost() {
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const submitPost = async (e) => {
    e.preventDefault();

    try {
      setLoading(true);
      setError("");
      setMessage("");

      await api.post("/posts", { content });

      setMessage("Post created successfully.");
      setContent("");
    } catch {
      setError("Failed to create post.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fade-in">
      <h2 className="page-title">Create Post</h2>

      <section className="glass-card form-card">
        <form onSubmit={submitPost} className="form-stack">
          <div className="field">
            <label>Post Content</label>
            <textarea
              rows="8"
              placeholder="Write your post..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
            />
          </div>

          <button className="btn btn-primary" type="submit" disabled={loading}>
            {loading ? "Posting..." : "Create Post"}
          </button>
        </form>

        {message ? <p className="success-text">{message}</p> : null}
        {error ? <p className="error-text">{error}</p> : null}
      </section>
    </div>
  );
}