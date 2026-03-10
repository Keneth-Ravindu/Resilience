import { useState } from "react";
import api from "../../api/client";
import CustomSelect from "../../components/CustomSelect";

export default function CreatePost() {
  const [content, setContent] = useState("");
  const [tags, setTags] = useState("");
  const [mediaUrl, setMediaUrl] = useState("");
  const [mediaType, setMediaType] = useState("");

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const submitPost = async (e) => {
    e.preventDefault();

    try {
      setLoading(true);
      setError("");
      setMessage("");

      const payload = {
        content,
        tags: tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
        media_url: mediaUrl || null,
        media_type: mediaType || null,
      };

      await api.post("/posts", payload);

      setMessage("Post created successfully.");
      setContent("");
      setTags("");
      setMediaUrl("");
      setMediaType("");
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
              placeholder="Share your workout, progress, or thoughts..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
            />
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

          <div className="field">
            <label>Media URL (optional)</label>
            <input
              type="text"
              placeholder="https://..."
              value={mediaUrl}
              onChange={(e) => setMediaUrl(e.target.value)}
            />
          </div>

          <div className="field">
            <CustomSelect
              label="Media Type"
              value={mediaType}
              onChange={setMediaType}
              options={[
                { value: "", label: "No media" },
                { value: "image", label: "Image" },
                { value: "video", label: "Video" },
              ]}
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