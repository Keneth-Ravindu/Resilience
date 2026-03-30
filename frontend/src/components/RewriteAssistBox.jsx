import { useState, useEffect, useRef } from "react";
import api from "../api/client";

function normalizeRewriteResponse(data) {
  if (!data) return null;

  if (typeof data === "string") {
    return {
      rewrite_suggestion: data,
      rewrite_reason: "",
      primary_emotion: "",
      toxicity_label: "",
    };
  }

  return {
    rewrite_suggestion:
      data.rewrite_suggestion ||
      data.suggestion ||
      data.rewritten_text ||
      data.rewrite ||
      data.text ||
      "",
    rewrite_reason:
      data.rewrite_reason ||
      data.reason ||
      "",
    primary_emotion:
      data.primary_emotion ||
      data.emotion ||
      "",
    toxicity_label:
      data.toxicity_label ||
      data.tone ||
      "",
  };
}

export default function RewriteAssistBox({
  text,
  onUseRewrite,
  compact = false,
  label = "Suggest AI Rewrite",
  autoTrigger = false,
}) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  // ✅ Prevent multiple auto triggers
  const lastTriggeredTextRef = useRef("");

  async function handleRewrite() {
    const trimmed = text.trim();

    if (!trimmed) {
      setError("Write something first to get a rewrite suggestion.");
      return;
    }

    try {
      setLoading(true);
      setError("");
      setResult(null);

      const res = await api.post("/rewrite", {
        text: trimmed,
      });

      const normalized = normalizeRewriteResponse(res.data);

      if (!normalized?.rewrite_suggestion) {
        setError("No rewrite suggestion was returned.");
        return;
      }

      setResult(normalized);
    } catch (err) {
      console.error("Rewrite request failed", err);
      setError("Failed to generate rewrite suggestion.");
    } finally {
      setLoading(false);
    }
  }

  // Reset suggestion when text changes manually
  useEffect(() => {
    if (!text) return;

    // If user edits text after suggestion → clear old result
    if (result && text !== lastTriggeredTextRef.current) {
      setResult(null);
    }
  }, [text]);

  // Auto-trigger logic (smart + safe)
  useEffect(() => {
    if (!autoTrigger) return;

    const trimmed = text?.trim();
    if (!trimmed || trimmed.length < 10) return;

    // Prevent repeated triggers for same text
    if (lastTriggeredTextRef.current === trimmed) return;

    if (!loading) {
      lastTriggeredTextRef.current = trimmed;
      handleRewrite();
    }
  }, [autoTrigger, text]);

  const rewriteSuggestion = result?.rewrite_suggestion || "";
  const rewriteReason = result?.rewrite_reason || "";
  const primaryEmotion = result?.primary_emotion || "";
  const toxicityLabel = result?.toxicity_label || "";

  return (
    <section className={`glass-card rewrite-assist-box ${compact ? "compact" : ""}`}>
      <div className="rewrite-assist-head">
        <div>
          <h3 className="rewrite-card-title">{label}</h3>
          <p className="rewrite-card-subtitle">
            Generate a clearer and more supportive version of your text before posting.
          </p>
        </div>

        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={handleRewrite}
          disabled={loading}
        >
          {loading ? "Generating..." : "Suggest AI Rewrite"}
        </button>
      </div>

      {error ? <p className="error-text">{error}</p> : null}

      {result ? (
        <div className="rewrite-assist-result">
          <div className="rewrite-meta-row">
            {primaryEmotion ? (
              <span className="tag-pill">Emotion: {primaryEmotion}</span>
            ) : null}

            {toxicityLabel ? (
              <span className="tag-pill">Tone: {toxicityLabel}</span>
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

          <div className="rewrite-assist-actions">
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => onUseRewrite?.(rewriteSuggestion)}
            >
              Use This Rewrite
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}