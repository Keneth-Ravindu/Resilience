import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../api/client";

export default function UserDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        setLoading(true);
        setError("");

        const res = await api.get("/analytics/dashboard", {
          params: { days: 30 },
        });

        setData(res.data);
      } catch {
        setError("Failed to load dashboard.");
      } finally {
        setLoading(false);
      }
    };

    fetchDashboard();
  }, []);

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

  const summary = data?.summary || {};
  const counts = data?.activity_counts || {};
  const snapshot = data?.snapshot || {};
  const insights = data?.insights || [];

  const postData = snapshot.post || {};
  const journalData = snapshot.journal || {};
  const commentData = snapshot.comment || {};

  const dominantEmotion =
    postData.dominant_primary_emotion_week ||
    journalData.dominant_primary_emotion_week ||
    commentData.dominant_primary_emotion_week ||
    "No data";

  const dominantTrend =
    postData.trend_text !== "No data"
      ? postData.trend_text
      : journalData.trend_text !== "No data"
      ? journalData.trend_text
      : commentData.trend_text || "Emotion pattern stable";

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
            {summary.avg_toxicity != null
              ? Number(summary.avg_toxicity).toFixed(3)
              : "N/A"}
          </h3>
          <p className="stat-text">
            Average toxicity score across your analyzed content.
          </p>
        </section>
      </div>

      <div className="stats-grid">
        <section className="glass-card stat-card">
          <p className="stat-label">Analyzed Posts (30 Days)</p>
          <h3 className="stat-value">{counts.posts ?? 0}</h3>
          <p className="stat-text">Analyzed posts in the last 30 days.</p>
        </section>

        <section className="glass-card stat-card">
          <p className="stat-label">Analyzed Journals (30 Days)</p>
          <h3 className="stat-value">{counts.journals ?? 0}</h3>
          <p className="stat-text">Analyzed journals in the last 30 days.</p>
        </section>

        <section className="glass-card stat-card">
          <p className="stat-label">Analyzed Comments (30 Days)</p>
          <h3 className="stat-value">{counts.comments ?? 0}</h3>
          <p className="stat-text">Analyzed comments in the last 30 days.</p>
        </section>
      </div>

      <div className="card-grid">
        <section className="glass-card">
          <div className="section-head">
            <h3>Quick Actions</h3>
          </div>

          <div className="quick-actions">
            <Link to="/app/posts/new" className="btn btn-primary">
              Create Post
            </Link>
            <Link to="/app/journals/new" className="btn btn-outline">
              Write Journal
            </Link>
            <Link to="/app/feed" className="btn btn-outline">
              Go to Feed
            </Link>
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
                <p>{postData.dominant_primary_emotion_week || "No data"}</p>
              </div>
              <span className="role-badge">
                {postData.trend_text || "No data"}
              </span>
            </div>

            <div className="simple-list-item">
              <div>
                <strong>Journals</strong>
                <p>{journalData.dominant_primary_emotion_week || "No data"}</p>
              </div>
              <span className="role-badge">
                {journalData.trend_text || "No data"}
              </span>
            </div>

            <div className="simple-list-item">
              <div>
                <strong>Comments</strong>
                <p>{commentData.dominant_primary_emotion_week || "No data"}</p>
              </div>
              <span className="role-badge">
                {commentData.trend_text || "No data"}
              </span>
            </div>
          </div>
        </section>
      </div>

      <section className="glass-card summary-section">
        <div className="section-head">
          <h3>AI Insights</h3>
        </div>

        {insights.length ? (
          <div className="summary-grid">
            {insights.map((item, index) => (
              <div className="summary-card" key={`${item.title}-${index}`}>
                <p className="summary-alert">{item.title}</p>
                <p>
                  <span className="summary-label">Type:</span>
                  <br />
                  <strong>{item.type}</strong>
                </p>
                <p>
                  <span className="summary-label">Insight:</span>
                  <br />
                  <strong>{item.message}</strong>
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p>No AI insights available yet.</p>
        )}
      </section>
    </div>
  );
}