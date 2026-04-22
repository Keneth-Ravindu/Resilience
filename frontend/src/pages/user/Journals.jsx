import { useEffect, useState } from "react";
import api from "../../api/client";
import CustomSelect from "../../components/CustomSelect";
import RewriteSuggestionCard from "../../components/RewriteSuggestionCard";
import ReactionButton from "../../components/ReactionButton";

function JournalAnalysisSection({ journalId, reactionCounts, onRefresh }) {
  const [analysis, setAnalysis] = useState(null);
  const [expanded, setExpanded] = useState(false);
  const [loadingAnalysis, setLoadingAnalysis] = useState(false);
  const [analysisError, setAnalysisError] = useState("");

  async function loadAnalysis() {
    try {
      setLoadingAnalysis(true);
      setAnalysisError("");

      const res = await api.get(`/journals/${journalId}/analysis`);
      setAnalysis(res.data);
    } catch {
      setAnalysisError("No analysis available for this journal yet.");
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

        <ReactionButton
          objectType="journal"
          objectId={journalId}
          counts={reactionCounts}
          onReact={onRefresh}
        />
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
                title="Journal Rewrite Suggestion"
                rewriteSuggestion={analysis.rewrite_suggestion}
                rewriteReason={analysis.rewrite_reason}
                primaryEmotion={analysis.primary_emotion}
                toxicityLabel={analysis.toxicity_label}
                objectLabel="journal entry"
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

export default function Journals() {
  const [journals, setJournals] = useState([]);
  const [visibilityFilter, setVisibilityFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function fetchJournals() {
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
  }

  useEffect(() => {
    fetchJournals();
  }, [visibilityFilter]);

  if (loading) {
    return (
      <div className="fade-in">
        <div className="page-head-with-actions">
          <div>
            <h2 className="page-title">Journals</h2>
            <p className="page-subtitle">
              View your journals.
            </p>
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
            <p className="page-subtitle">
              View your journals.
            </p>
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
          <p className="page-subtitle">
            View your journals.
          </p>
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
                    journal.visibility === "public"
                      ? "visibility-public"
                      : "visibility-private"
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

              <JournalAnalysisSection
                journalId={journal.id}
                reactionCounts={journal.reaction_counts}
                onRefresh={fetchJournals}
              />
            </section>
          ))}
        </div>
      )}
    </div>
  );
}