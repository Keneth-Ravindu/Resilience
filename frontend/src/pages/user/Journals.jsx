import { useEffect, useState } from "react";
import api from "../../api/client";

export default function Journals() {
  const [journals, setJournals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchJournals = async () => {
      try {
        setLoading(true);
        setError("");
        const res = await api.get("/journals");
        setJournals(res.data || []);
      } catch {
        setError("Failed to load journals.");
      } finally {
        setLoading(false);
      }
    };

    fetchJournals();
  }, []);

  if (loading) {
    return (
      <div className="fade-in">
        <h2 className="page-title">Journals</h2>
        <section className="glass-card">
          <p>Loading journals...</p>
        </section>
      </div>
    );
  }

  if (error) {
    return (
      <div className="fade-in">
        <h2 className="page-title">Journals</h2>
        <p className="error-text">{error}</p>
      </div>
    );
  }

  return (
    <div className="fade-in">
      <h2 className="page-title">Journals</h2>

      {journals.length === 0 ? (
        <section className="glass-card">
          <p>No journals yet.</p>
        </section>
      ) : (
        <div className="feed-list">
          {journals.map((journal) => (
            <section className="glass-card feed-card" key={journal.id}>
              <div className="feed-card-head">
                <h3>Journal #{journal.id}</h3>
              </div>
              <p className="feed-body">{journal.content || journal.text || "No content"}</p>
              <div className="feed-meta">
                <span>Created: {journal.created_at ? new Date(journal.created_at).toLocaleString() : "N/A"}</span>
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}