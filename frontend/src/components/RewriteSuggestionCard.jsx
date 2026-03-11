import { useState } from "react";

export default function RewriteSuggestionCard({
  title = "Rewrite Suggestion",
  rewriteSuggestion,
  rewriteReason,
  primaryEmotion,
  toxicityLabel,
  objectLabel = "content",
}) {
  const [copied, setCopied] = useState(false);

  if (!rewriteSuggestion) return null;

  async function copySuggestion() {
    try {
      await navigator.clipboard.writeText(rewriteSuggestion);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch (err) {
      console.error("Failed to copy rewrite suggestion", err);
    }
  }

  return (
    <section className="glass-card rewrite-card">
      <div className="rewrite-card-head">
        <div>
          <h3 className="rewrite-card-title">{title}</h3>
          <p className="rewrite-card-subtitle">
            A more supportive rewrite is available for this {objectLabel}.
          </p>
        </div>

        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={copySuggestion}
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>

      <div className="rewrite-meta-row">
        {primaryEmotion ? (
          <span className="tag-pill">
            Emotion: {primaryEmotion}
          </span>
        ) : null}

        {toxicityLabel ? (
          <span className="tag-pill">
            Tone: {toxicityLabel}
          </span>
        ) : null}
      </div>

      {rewriteReason ? (
        <div className="rewrite-reason-box">
          <p className="rewrite-reason-label">Why this was suggested</p>
          <p className="rewrite-reason-text">{rewriteReason}</p>
        </div>
      ) : null}

      <div className="rewrite-suggestion-box">
        <p className="rewrite-reason-label">Suggested rewrite</p>
        <p className="rewrite-suggestion-text">{rewriteSuggestion}</p>
      </div>
    </section>
  );
}