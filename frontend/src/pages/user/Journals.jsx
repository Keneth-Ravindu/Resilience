import { useEffect, useState } from "react";
import api from "../../api/client";
import CustomSelect from "../../components/CustomSelect";

export default function Journals() {
  const [journals, setJournals] = useState([]);
  const [visibilityFilter, setVisibilityFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchJournals = async () => {
      try {
        setLoading(true);
        setError("");

        let url = "/journals";
        if (visibilityFilter !== "all") {
          url = `/journals?visibility=${visibilityFilter}`;
        }

        const res = await api.get(url);
        setJournals(res.data || []);
      } catch {
        setError("Failed to load journals.");
      } finally {
        setLoading(false);
      }
    };

    fetchJournals();
  }, [visibilityFilter]);

  if (loading) {
    return (
      <div className="fade-in">
        <div className="page-head-with-actions">
          <div>
            <h2 className="page-title">Journals</h2>
            <p className="page-subtitle">View your journals and public community journals.</p>
          </div>
        </div>

        <section className="glass-card">
          <p>Loading journals...</p>
        </section>
      </div>
    );
  }

  if (error) {
    return (
      <div className="fade-in">
        <div className="page-head-with-actions">
          <div>
            <h2 className="page-title">Journals</h2>
            <p className="page-subtitle">View your journals and public community journals.</p>
          </div>
        </div>

        <p className="error-text">{error}</p>
      </div>
    );
  }

  return (
    <div className="fade-in">
      <div className="page-head-with-actions">
        <div>
          <h2 className="page-title">Journals</h2>
          <p className="page-subtitle">View your journals and public community journals.</p>
        </div>

        <div className="filter-wrap">
            <CustomSelect
                label="Visibility"
                value={visibilityFilter}
                onChange={setVisibilityFilter}
                options={[
                { value: "all", label: "All I can see" },
                { value: "public", label: "Public only" },
                { value: "private", label: "Private only" },
                ]}
            />
        </div>
      </div>

      {journals.length === 0 ? (
        <section className="glass-card">
          <p>No journals found for this filter.</p>
        </section>
      ) : (
        <div className="journal-grid">
          {journals.map((journal) => (
            <section className="glass-card journal-card" key={journal.id}>
              <div className="journal-card-top">
                <span
                  className={`visibility-badge ${
                    journal.visibility === "public" ? "visibility-public" : "visibility-private"
                  }`}
                >
                  {journal.visibility || "private"}
                </span>
              </div>

              <h3 className="journal-card-title">
                {journal.title || `Journal #${journal.id}`}
              </h3>

              <p className="feed-subtitle">
                Entry Date: {journal.entry_date || "N/A"}
              </p>

              <p className="journal-card-body">
                {journal.content || "No content"}
              </p>

              <div className="journal-card-footer">
                <span>
                  Created:{" "}
                  {journal.created_at
                    ? new Date(journal.created_at).toLocaleString()
                    : "N/A"}
                </span>
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}