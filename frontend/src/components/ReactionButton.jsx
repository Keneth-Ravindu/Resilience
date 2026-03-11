import { useEffect, useMemo, useState } from "react";
import api from "../api/client";

function getTotal(counts) {
  return Object.values(counts || {}).reduce((sum, value) => sum + value, 0);
}

export default function ReactionButton({
  objectType,
  objectId,
  counts = {},
  initialLiked = false,
  onReact,
}) {
  const [liked, setLiked] = useState(initialLiked);
  const [localCounts, setLocalCounts] = useState(counts || {});
  const [loading, setLoading] = useState(false);
  const [burst, setBurst] = useState(false);

  useEffect(() => {
    setLocalCounts(counts || {});
  }, [counts]);

  const total = useMemo(() => getTotal(localCounts), [localCounts]);

  async function toggleLike() {
    if (loading) return;

    const previousLiked = liked;
    const previousCounts = { ...localCounts };

    const nextCounts = { ...localCounts };
    const currentLikeCount = nextCounts.like || 0;

    if (liked) {
      if (currentLikeCount <= 1) {
        delete nextCounts.like;
      } else {
        nextCounts.like = currentLikeCount - 1;
      }
      setLiked(false);
    } else {
      nextCounts.like = currentLikeCount + 1;
      setLiked(true);
      setBurst(true);
      setTimeout(() => setBurst(false), 380);
    }

    setLocalCounts(nextCounts);
    setLoading(true);

    try {
      await api.post("/reactions/react", {
        object_type: objectType,
        object_id: objectId,
        reaction_type: "like",
      });

      if (onReact) {
        onReact();
      }
    } catch (err) {
      console.error("Like failed", err);
      setLiked(previousLiked);
      setLocalCounts(previousCounts);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="ig-like-wrap">
      <button
        type="button"
        className={`ig-like-btn ${liked ? "liked" : ""} ${burst ? "burst" : ""}`}
        onClick={toggleLike}
        disabled={loading}
        aria-label={liked ? "Unlike" : "Like"}
      >
        <span className="ig-like-heart">
          {liked ? "❤" : "♡"}
        </span>
        <span className="ig-like-text">
          {liked ? "Liked" : "Like"}
        </span>
      </button>

      <span className="ig-like-count">
        {total}
      </span>
    </div>
  );
}