import { useState } from "react";
import api from "../../api/client";
import CustomSelect from "../../components/CustomSelect";

export default function CreateJournal() {
  const [entryDate, setEntryDate] = useState("");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [visibility, setVisibility] = useState("private");

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const submitJournal = async (e) => {
    e.preventDefault();

    try {
      setLoading(true);
      setError("");
      setMessage("");

      const payload = {
        entry_date: entryDate || null,
        title: title || null,
        content,
        visibility,
      };

      await api.post("/journals", payload);

      setMessage("Journal created successfully.");
      setEntryDate("");
      setTitle("");
      setContent("");
      setVisibility("private");
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