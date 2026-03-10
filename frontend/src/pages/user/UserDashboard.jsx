import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../api/client";

function buildSnapshotText(typeData) {
  const dominant = typeData?.dominant_primary_emotion_week || "unknown";
  const trends = typeData?.trends || {};

  if (
    ["anger", "annoyance", "sadness", "fear", "disappointment", "disgust"].includes(
      dominant
    ) &&
    trends[dominant] === "up"
  ) {
    return "Negative emotion increasing";
  }

  if (trends.joy === "up" || trends.optimism === "up") {
    return "Positive emotions increasing";
  }

  if (Object.values(trends).includes("up")) {
    return "Emotional intensity increasing";
  }

  return "Emotion pattern stable";
}

export default function UserDashboard() {
  const [summary, setSummary] = useState(null);
  const [bundle, setBundle] = useState(null);
  const [counts, setCounts] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        setLoading(true);
        setError("");

        const params = new URLSearchParams();

        [
          "joy",
          "sadness",
          "anger",
          "optimism",
          "annoyance",
          "fear",
          "love",
          "caring",
          "neutral",
          "disappointment",
        ].forEach((e) => params.append("emotions", e));

        params.append("days", "30");
        params.append("window", "7");
        params.append("top_n", "3");
        params.append("include_series", "true");

        const [summaryRes, bundleRes, countsRes] = await Promise.all([
          api.get("/analytics/summary"),
          api.get(`/analytics/mood/dashboard/bundle/by-type?${params.toString()}`),
          api.get("/analytics/activity/counts?days=30"),
        ]);

        setSummary(summaryRes.data);
        setBundle(bundleRes.data);
        setCounts(countsRes.data);
      } catch {
        setError("Failed to load dashboard.");
      } finally {
        setLoading(false);
      }
    };

    fetchDashboard();
  }, []);

  const postData = bundle?.by_type?.post;
  const journalData = bundle?.by_type?.journal;
  const commentData = bundle?.by_type?.comment;

  const dominantEmotion =
    postData?.dominant_primary_emotion_week ||
    journalData?.dominant_primary_emotion_week ||
    commentData?.dominant_primary_emotion_week ||
    "No data";

  const dominantTrend =
    buildSnapshotText(postData) !== "Emotion pattern stable"
      ? buildSnapshotText(postData)
      : buildSnapshotText(journalData) !== "Emotion pattern stable"
      ? buildSnapshotText(journalData)
      : buildSnapshotText(commentData);

  const postsCount = counts?.counts?.posts ?? 0;
  const journalsCount = counts?.counts?.journals ?? 0;
  const commentsCount = counts?.counts?.comments ?? 0;

  if (loading) {
    return (
      <div className="fade-in">
        <h2 className="page-title">User Dashboard</h2>
        <section className="glass-card">
          <p>Loading dashboard...</p>
        </section>
      </div>
    );
  }

  if (error) {
    return (
      <div className="fade-in">
        <h2 className="page-title">User Dashboard</h2>
        <p className="error-text">{error}</p>
      </div>
    );
  }

  return (
    <div className="fade-in">
      <div className="dashboard-head">
        <div>
          <h2 className="page-title">User Dashboard</h2>
          <p className="page-subtitle">
            Your personal emotional overview and recent activity.
          </p>
        </div>
      </div>

      <div className="stats-grid">
        <section className="glass-card stat-card">
          <p className="stat-label">Dominant Emotion</p>
          <h3 className="stat-value">{dominantEmotion}</h3>
          <p className="stat-text">Most dominant emotional state this week.</p>
        </section>

        <section className="glass-card stat-card">
          <p className="stat-label">Trend</p>
          <h3 className="stat-value dashboard-stat-small">{dominantTrend}</h3>
          <p className="stat-text">AI summary of your emotional direction.</p>
        </section>

        <section className="glass-card stat-card">
          <p className="stat-label">Average Toxicity</p>
          <h3 className="stat-value">
            {summary?.avg_toxicity != null ? Number(summary.avg_toxicity).toFixed(3) : "N/A"}
          </h3>
          <p className="stat-text">Average toxicity score across your analyzed content.</p>
        </section>
      </div>

      <div className="stats-grid">
        <section className="glass-card stat-card">
          <p className="stat-label">Analyzed Posts (30 days)</p>
          <h3 className="stat-value">{postsCount}</h3>
          <p className="stat-text">Analyzed posts in the last 30 days.</p>
        </section>

        <section className="glass-card stat-card">
          <p className="stat-label">Analyzed Journals (30 days)</p>
          <h3 className="stat-value">{journalsCount}</h3>
          <p className="stat-text">Analyzed journals in the last 30 days.</p>
        </section>

        <section className="glass-card stat-card">
          <p className="stat-label">Analyzed Comments (30 days)</p>
          <h3 className="stat-value">{commentsCount}</h3>
          <p className="stat-text">Analyzed comments in the last 30 days.</p>
        </section>
      </div>

      <div className="card-grid">
        <section className="glass-card">
          <div className="section-head">
            <h3>Quick Actions</h3>
          </div>

          <div className="quick-actions">
            <button className="btn btn-primary" type="button">Create Post</button>
            <button className="btn btn-outline" type="button">Write Journal</button>
            <button className="btn btn-outline" type="button">Rewrite Tool</button>
            <Link to="/app/analytics" className="btn btn-outline">
              View Analytics
            </Link>
          </div>
        </section>

        <section className="glass-card">
          <div className="section-head">
            <h3>Emotional Snapshot</h3>
          </div>

          <div className="simple-list">
            <div className="simple-list-item">
              <div>
                <strong>Posts</strong>
                <p>{postData?.dominant_primary_emotion_week || "No data"}</p>
              </div>
              <span className="role-badge">{buildSnapshotText(postData)}</span>
            </div>

            <div className="simple-list-item">
              <div>
                <strong>Journals</strong>
                <p>{journalData?.dominant_primary_emotion_week || "No data"}</p>
              </div>
              <span className="role-badge">{buildSnapshotText(journalData)}</span>
            </div>

            <div className="simple-list-item">
              <div>
                <strong>Comments</strong>
                <p>{commentData?.dominant_primary_emotion_week || "No data"}</p>
              </div>
              <span className="role-badge">{buildSnapshotText(commentData)}</span>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}