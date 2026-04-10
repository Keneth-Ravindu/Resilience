import { useEffect } from "react";

export default function BlockedContentModal({
  open,
  onClose,
  title = "Content Blocked",
  message = "",
  toxicityLabel = "",
  primaryEmotion = "",
}) {
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        onClose?.();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="blocked-modal-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="blocked-modal-title"
    >
      <div
        className="blocked-modal-card glass-card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="blocked-modal-alert-dot" />

        <div className="blocked-modal-head">
          <div>
            <p className="blocked-modal-eyebrow">Moderation Alert</p>
            <h3 id="blocked-modal-title" className="blocked-modal-title">
              {title}
            </h3>
          </div>

          <button
            type="button"
            className="blocked-modal-close-btn"
            onClick={onClose}
            aria-label="Close blocked content modal"
          >
            ×
          </button>
        </div>

        <div className="blocked-modal-body">
          <p className="blocked-modal-message">
            {message ||
              "This message was blocked because it may be harmful, aggressive, or disrespectful."}
          </p>

          {(primaryEmotion || toxicityLabel) ? (
            <div className="blocked-modal-badges">
              {primaryEmotion ? (
                <span className="tag-pill">Emotion: {primaryEmotion}</span>
              ) : null}

              {toxicityLabel ? (
                <span className="tag-pill">Tone: {toxicityLabel}</span>
              ) : null}
            </div>
          ) : null}

          <div className="blocked-modal-guidance">
            <p className="blocked-modal-guidance-title">What to do next</p>
            <p className="blocked-modal-guidance-text">
              Please revise your wording and use the AI rewrite suggestion to
              make your message more respectful, supportive, and safe to post.
            </p>
          </div>
        </div>

        <div className="blocked-modal-actions">
          <button
            type="button"
            className="btn btn-primary"
            onClick={onClose}
          >
            Revise Content
          </button>
        </div>
      </div>
    </div>
  );
}