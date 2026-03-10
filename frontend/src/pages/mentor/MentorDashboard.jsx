import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../api/client";

function buildMenteeSummary(analytics, menteeUserId) {
  const post = analytics?.by_type?.post;
  const journal = analytics?.by_type?.journal;
  const comment = analytics?.by_type?.comment;

  const dominant =
    post?.dominant_primary_emotion_week ||
    journal?.dominant_primary_emotion_week ||
    comment?.dominant_primary_emotion_week ||
    "unknown";

  const trendCandidates = [
    ...(post?.top_week || []),
    ...(journal?.top_week || []),
    ...(comment?.top_week || []),
  ];

  const topEmotion = trendCandidates.length
    ? trendCandidates.sort((a, b) => b.avg - a.avg)[0]?.emotion
    : null;

  const topTrend =
    (topEmotion && post?.trends?.[topEmotion]) ||
    (topEmotion && journal?.trends?.[topEmotion]) ||
    (topEmotion && comment?.trends?.[topEmotion]) ||
    "stable";

  const negativeEmotions = [
    "anger",
    "annoyance",
    "sadness",
    "fear",
    "disappointment",
    "disapproval",
    "disgust",
    "grief",
    "remorse",
  ];

  const summaryText =
    negativeEmotions.includes(dominant) && topTrend === "up"
      ? "Increasing negative emotion"
      : topTrend === "up"
      ? "Emotional intensity increasing"
      : topTrend === "down"
      ? "Emotional intensity decreasing"
      : "Emotion pattern stable";

  return {
    menteeUserId,
    dominant,
    trend: topTrend,
    summaryText,
  };
}

export default function MentorDashboard() {
  const [summary, setSummary] = useState(null);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [mentees, setMentees] = useState([]);
  const [menteeSummaries, setMenteeSummaries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadDashboard = async () => {
      try {
        setLoading(true);
        setError("");

        const [summaryRes, requestsRes, menteesRes] = await Promise.all([
          api.get("/mentors/summary"),
          api.get("/mentors/requests/pending/detailed"),
          api.get("/mentors/mentees"),
        ]);

        const menteesData = menteesRes.data || [];

        setSummary(summaryRes.data);
        setPendingRequests(requestsRes.data || []);
        setMentees(menteesData);

        const analyticsResponses = await Promise.all(
          menteesData.slice(0, 5).map(async (m) => {
            try {
              const res = await api.get(`/mentors/${m.mentee_user_id}/analytics`, {
                params: {
                  days: 30,
                  window: 7,
                  top_n: 3,
                  include_series: false,
                },
              });
              return buildMenteeSummary(res.data, m.mentee_user_id);
            } catch {
              return {
                menteeUserId: m.mentee_user_id,
                dominant: "unknown",
                trend: "stable",
                summaryText: "Analytics unavailable",
              };
            }
          })
        );

        setMenteeSummaries(analyticsResponses);
      } catch {
        setError("Failed to load mentor dashboard.");
      } finally {
        setLoading(false);
      }
    };

    loadDashboard();
  }, []);

  if (loading) {
    return (
      <div className="fade-in">
        <h2 className="page-title">Mentor Dashboard</h2>
        <section className="glass-card">
          <p>Loading dashboard...</p>
        </section>
      </div>
    );
  }

  if (error) {
    return (
      <div className="fade-in">
        <h2 className="page-title">Mentor Dashboard</h2>
        <p className="error-text">{error}</p>
      </div>
    );
  }

  return (
    <div className="fade-in">
      <div className="dashboard-head">
        <div>
          <h2 className="page-title">Mentor Dashboard</h2>
          <p className="page-subtitle">
            Review mentorship activity and identify mentees who may need support.
          </p>
        </div>
      </div>

      <div className="stats-grid">
        <section className="glass-card stat-card">
          <p className="stat-label">Pending Requests</p>
          <h3 className="stat-value">{pendingRequests.length}</h3>
          <p className="stat-text">Mentorship requests waiting for your decision.</p>
        </section>

        <section className="glass-card stat-card">
          <p className="stat-label">Active Mentees</p>
          <h3 className="stat-value">{mentees.length}</h3>
          <p className="stat-text">Accepted mentees currently under your support.</p>
        </section>

        <section className="glass-card stat-card">
          <p className="stat-label">As Mentee</p>
          <h3 className="stat-value">
            {summary?.as_mentee?.accepted_mentors_count ?? 0}
          </h3>
          <p className="stat-text">Mentors assigned to your own account.</p>
        </section>
      </div>

      <div className="card-grid">
        <section className="glass-card">
          <div className="section-head">
            <h3>Quick Actions</h3>
          </div>

          <div className="quick-actions">
            <Link to="/mentor/requests" className="btn btn-primary">
              Open Requests
            </Link>
            <Link to="/mentor/mentees" className="btn btn-outline">
              View Mentees
            </Link>
          </div>
        </section>

        <section className="glass-card">
          <div className="section-head">
            <h3>Pending Requests Preview</h3>
          </div>

          {pendingRequests.length ? (
            <div className="simple-list">
              {pendingRequests.slice(0, 3).map((req) => (
                <div className="simple-list-item" key={req.id}>
                  <div>
                    <strong>{req.mentee?.email || `User ${req.mentee?.id}`}</strong>
                    <p>Request #{req.id}</p>
                  </div>
                  <span className="role-badge">{req.status}</span>
                </div>
              ))}
            </div>
          ) : (
            <p>No pending mentorship requests.</p>
          )}
        </section>

        <section className="glass-card">
          <div className="section-head">
            <h3>Active Mentees Preview</h3>
          </div>

          {mentees.length ? (
            <div className="simple-list">
              {mentees.slice(0, 5).map((m) => (
                <div className="simple-list-item" key={m.id}>
                  <div>
                    <strong>Mentee #{m.mentee_user_id}</strong>
                    <p>Mentorship #{m.id}</p>
                  </div>

                  <Link
                    to={`/mentor/mentees/${m.mentee_user_id}/analytics`}
                    className="btn btn-outline btn-sm"
                  >
                    Analytics
                  </Link>
                </div>
              ))}
            </div>
          ) : (
            <p>No active mentees yet.</p>
          )}
        </section>
      </div>

      <section className="glass-card summary-section">
        <div className="section-head">
          <h3>Mentee Mental Health Summary</h3>
        </div>

        {menteeSummaries.length ? (
          <div className="summary-grid">
            {menteeSummaries.map((item) => (
              <div className="summary-card" key={item.menteeUserId}>
                <p className="summary-alert">⚠ Mentee #{item.menteeUserId}</p>
                <p>
                  <span className="summary-label">Dominant emotion this week:</span>
                  <br />
                  <strong>{item.dominant}</strong>
                </p>
                <p>
                  <span className="summary-label">Trend:</span>
                  <br />
                  <strong>{item.summaryText}</strong>
                </p>

                <Link
                  to={`/mentor/mentees/${item.menteeUserId}/analytics`}
                  className="btn btn-primary btn-sm"
                >
                  Open Analytics
                </Link>
              </div>
            ))}
          </div>
        ) : (
          <p>No mentee summaries available yet.</p>
        )}
      </section>
    </div>
  );
}