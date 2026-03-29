import { useEffect, useMemo, useState } from "react";
import api from "../../api/client";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  BarChart,
  Bar,
} from "recharts";

const EMOTION_COLORS = {
  joy: "#facc15",
  anger: "#ef4444",
  sadness: "#60a5fa",
  optimism: "#22c55e",
  annoyance: "#fb923c",
  fear: "#a78bfa",
  love: "#f472b6",
  caring: "#34d399",
  neutral: "#94a3b8",
  disappointment: "#818cf8",
  admiration: "#2dd4bf",
  amusement: "#fbbf24",
  approval: "#4ade80",
  confusion: "#c084fc",
  curiosity: "#38bdf8",
  desire: "#f97316",
  disapproval: "#dc2626",
  disgust: "#84cc16",
  embarrassment: "#f9a8d4",
  excitement: "#eab308",
  gratitude: "#10b981",
  grief: "#6366f1",
  nervousness: "#a855f7",
  pride: "#14b8a6",
  realization: "#06b6d4",
  relief: "#22c55e",
  remorse: "#8b5cf6",
  surprise: "#0ea5e9",
};

function formatAvg(value) {
  const n = Number(value);
  if (Number.isNaN(n)) return "0.000";
  return n.toFixed(3);
}

function EmotionList({ title, items }) {
  return (
    <section className="glass-card">
      <h3>{title}</h3>
      {items?.length ? (
        <div className="emotion-chip-wrap">
          {items.map((item) => (
            <div className="emotion-chip" key={item.emotion}>
              <span>{item.emotion}</span>
              <strong>{formatAvg(item.avg)}</strong>
            </div>
          ))}
        </div>
      ) : (
        <p>No data available.</p>
      )}
    </section>
  );
}

function TrendBadge({ value }) {
  const cls =
    value === "up"
      ? "trend-up"
      : value === "down"
      ? "trend-down"
      : "trend-stable";

  return <span className={`trend-badge ${cls}`}>{value}</span>;
}

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
    return "Positive emotion increasing";
  }

  if (Object.values(trends).includes("up")) {
    return "Emotional intensity increasing";
  }

  return "Emotion pattern stable";
}

function TypeOverviewCard({ label, data }) {
  const selectedEmotions = useMemo(() => {
    const topWeek = data?.top_week || [];
    return topWeek.map((item) => item.emotion).slice(0, 5);
  }, [data]);

  const chartData = useMemo(() => {
    if (!data?.series || !selectedEmotions.length) return [];

    const firstEmotion = selectedEmotions[0];
    const baseSeries = data.series[firstEmotion] || [];

    return baseSeries.map((point, idx) => {
      const row = { day: point.day };
      for (const emotion of selectedEmotions) {
        row[emotion] = data.series[emotion]?.[idx]?.value ?? 0;
      }
      return row;
    });
  }, [data, selectedEmotions]);

  return (
    <div className="analytics-type-block">
      <div className="analytics-type-head">
        <h3>{label}</h3>
        <span className="role-badge">{data?.object_type || label.toLowerCase()}</span>
      </div>

      <div className="card-grid">
        <EmotionList title="Top Emotions Today" items={data?.top_today || []} />
        <EmotionList title="Top Emotions This Week" items={data?.top_week || []} />

        <section className="glass-card">
          <h3>Dominant Primary Emotion</h3>
          <div className="dominant-emotion-box">
            {data?.dominant_primary_emotion_week || "No data"}
          </div>
        </section>

        <section className="glass-card">
          <h3>Trends</h3>
          {data?.trends && selectedEmotions.length ? (
            <div className="trend-grid">
              {selectedEmotions.map((emotion) => (
                <div className="trend-row" key={emotion}>
                  <span>{emotion}</span>
                  <TrendBadge value={data.trends?.[emotion] || "stable"} />
                </div>
              ))}
            </div>
          ) : (
            <p>No trends available.</p>
          )}
        </section>
      </div>

      <section className="glass-card chart-card">
        <div className="card-head">
          <div>
            <h3>{label} Emotion Series</h3>
            <p>Top weekly emotions plotted across available days.</p>
          </div>
        </div>

        {selectedEmotions.length ? (
          <div className="chart-legend">
            {selectedEmotions.map((emotion) => (
              <div className="chart-legend-item" key={emotion}>
                <span
                  className="chart-legend-dot"
                  style={{ backgroundColor: EMOTION_COLORS[emotion] || "#7c9cff" }}
                />
                <span>{emotion}</span>
              </div>
            ))}
          </div>
        ) : null}

        {chartData.length > 1 ? (
          <div className="chart-wrap">
            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="day" />
                <YAxis />
                <Tooltip formatter={(value) => formatAvg(value)} />
                {selectedEmotions.map((emotion) => (
                  <Line
                    key={emotion}
                    type="monotone"
                    dataKey={emotion}
                    stroke={EMOTION_COLORS[emotion] || "#7c9cff"}
                    strokeWidth={2.5}
                    dot={{ r: 3 }}
                    activeDot={{ r: 5 }}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p>Not enough data yet to display an emotion trend.</p>
        )}
      </section>
    </div>
  );
}

function buildHeatmapRows(bundleData) {
  if (!bundleData?.by_type) return [];

  const allSeries = [
    bundleData.by_type.post?.series || {},
    bundleData.by_type.journal?.series || {},
    bundleData.by_type.comment?.series || {},
  ];

  const emotionMap = {};

  for (const seriesGroup of allSeries) {
    for (const [emotion, points] of Object.entries(seriesGroup)) {
      if (!emotionMap[emotion]) {
        emotionMap[emotion] = {};
      }

      points.forEach((point) => {
        const day = point.day;
        const value = Number(point.value || 0);
        emotionMap[emotion][day] = (emotionMap[emotion][day] || 0) + value;
      });
    }
  }

  return Object.entries(emotionMap).map(([emotion, dayMap]) => ({
    emotion,
    ...dayMap,
  }));
}

function truncateText(text, maxLength = 40) {
  if (!text) return "Untitled Journal";
  return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
}

export default function AnalyticsOverview() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [toxicityData, setToxicityData] = useState([]);
  const [journalTimeline, setJournalTimeline] = useState([]);

  useEffect(() => {
    const fetchAnalytics = async () => {
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
        ].forEach((emotion) => params.append("emotions", emotion));

        params.append("days", "30");
        params.append("window", "7");
        params.append("top_n", "3");
        params.append("include_series", "true");
        params.append("debug", "true");

        const [bundleRes, toxicityRes, journalRes] = await Promise.all([
          api.get(`/analytics/mood/dashboard/bundle/by-type?${params.toString()}`),
          api.get("/analytics/toxicity/timeline?days=30"),
          api.get("/analytics/journals/timeline?days=30"),
        ]);

        setData(bundleRes.data);
        setToxicityData(toxicityRes.data?.points || []);
        setJournalTimeline(journalRes.data?.timeline || []);

      } catch {
        setError("Failed to load analytics overview.");
      } finally {
        setLoading(false);
      }
    };

    fetchAnalytics();
  }, []);

  const snapshotPost = data?.by_type?.post;
  const snapshotJournal = data?.by_type?.journal;
  const snapshotComment = data?.by_type?.comment;

  const heatmapRows = buildHeatmapRows(data);
  const heatmapDays =
  heatmapRows.length > 0
    ? Object.keys(heatmapRows[0]).filter((key) => key !== "emotion").slice(-7)
    : [];

  if (loading) {
    return (
      <div className="fade-in">
        <h2 className="page-title">Analytics Overview</h2>
        <section className="glass-card">
          <p>Loading analytics...</p>
        </section>
      </div>
    );
  }

  if (error) {
    return (
      <div className="fade-in">
        <h2 className="page-title">Analytics Overview</h2>
        <p className="error-text">{error}</p>
      </div>
    );
  }

  return (
    <div className="fade-in">
      <div className="analytics-page-head">
        <div>
          <h2 className="page-title">Analytics Overview</h2>
          <p className="page-subtitle">
            Track your emotional trends across posts and journals.
          </p>
        </div>

        <div className="analytics-meta-box">
          <div>
            <span className="meta-label">Range</span>
            <strong>{data?.range_days} days</strong>
          </div>
          <div>
            <span className="meta-label">Window</span>
            <strong>{data?.window_days} days</strong>
          </div>
          <div>
            <span className="meta-label">Top N</span>
            <strong>{data?.top_n}</strong>
          </div>
        </div>
      </div>

      <section className="glass-card chart-card">
        <div className="card-head">
          <div>
            <h3>Toxicity Trend</h3>
            <p>Average toxicity score across recent days.</p>
          </div>
        </div>

        {toxicityData.length > 0 ? (
          <div className="chart-wrap">
            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={toxicityData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="day" />
                <YAxis />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="#ef4444"
                  strokeWidth={2.5}
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p>No toxicity trend data available yet.</p>
        )}
      </section>

      <section className="glass-card">
        <div className="section-head">
          <h3 style={{ marginBottom: "6px" }}>Emotion Heatmap</h3>
          <p style={{ opacity: 0.7, marginBottom: "10px" }}>
            Visual intensity of emotions over the last 7 days.
          </p>
        </div>

        {heatmapRows.length > 0 && heatmapDays.length > 0 ? (
          <div style={{ overflowX: "auto" }}>
            <table
              className="analytics-heatmap-table"
              style={{ borderSpacing: "8px" }}
            >
              <thead>
                <tr>
                  <th>Emotion</th>
                  {heatmapDays.map((day) => (
                    <th key={day} style={{ opacity: 0.7 }}>
                      {day.slice(5)}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {heatmapRows
                  .sort((a, b,) => {
                    const aTotal = Object.values(a)
                      .filter((v) => typeof v === "number")
                      .reduce((sum, v) => sum + v, 0);

                    const bTotal = Object.values(b)
                      .filter((v) => typeof v === "number")
                      .reduce((sum, v) => sum + v, 0);

                    return bTotal - aTotal;
                  })
                  .slice(0, 6)
                  .map((row) => (
                    <tr key={row.emotion}>
                      <td style={{ fontWeight: 600 }}>{row.emotion}</td>

                      {heatmapDays.map((day) => {
                        const value = Number(row[day] || 0);

                        const getHeatColor = (v) => {
                          if (v >= 0.7) return "#ef4444"; // red
                          if (v >= 0.4) return "#f97316"; // orange
                          if (v >= 0.2) return "#eab308"; // yellow
                          if (v >= 0.05) return "#22c55e"; // green
                          return "#595c61"; // dark
                        };

                        const color = getHeatColor(value);

                        return (
                          <td
                            key={day}
                            title={`${row.emotion} on ${day}: ${value.toFixed(3)}`}
                            style={{
                              background: color,
                              color: value > 0.2 ? "#000000" : "#000000",
                              textAlign: "center",
                              borderRadius: "10px",
                              padding: "10px",
                              fontWeight: 600,
                              minWidth: "42px",
                              cursor: "pointer",
                              transition: "all 0.2s ease",
                            }}
                          >
                            {value > 0.0001 ? value.toFixed(3) : ""}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
              </tbody>
            </table>

            <div
              style={{
                marginTop: "12px",
                display: "flex",
                gap: "10px",
                flexWrap: "wrap",
              }}
            >
              <span style={{ background: "#ef4444", padding: "4px 8px", borderRadius: "6px" }}>
                Strong
              </span>
              <span style={{ background: "#f97316", padding: "4px 8px", borderRadius: "6px" }}>
                Moderate
              </span>
              <span style={{ background: "#eab308", padding: "4px 8px", borderRadius: "6px" }}>
                Mild
              </span>
              <span style={{ background: "#22c55e", padding: "4px 8px", borderRadius: "6px" }}>
                Minimal
              </span>
            </div>
          </div>
        ) : (
          <p>No heatmap data available yet.</p>
        )}
      </section>

      <section className="glass-card">
        <div className="section-head">
          <h3>Journal Emotional Timeline</h3>
          <p style={{ marginTop: "4px", opacity: 0.8 }}>
            Recent journal entries with emotional analysis.
          </p>
        </div>

        {journalTimeline.length ? (
          <div className="simple-list">
            {journalTimeline.slice(0, 6).map((item, index) => {
              const toxicity =
                item.toxicity_score != null ? Number(item.toxicity_score) : null;

              let toxicityLabel = "No score";
              let toxicityClass = "role-badge";

              if (toxicity != null) {
                if (toxicity >= 0.6) {
                  toxicityLabel = `High ${toxicity.toFixed(3)}`;
                  toxicityClass = "trend-badge trend-up";
                } else if (toxicity >= 0.4) {
                  toxicityLabel = `Moderate ${toxicity.toFixed(3)}`;
                  toxicityClass = "trend-badge trend-stable";
                } else {
                  toxicityLabel = `Low ${toxicity.toFixed(3)}`;
                  toxicityClass = "trend-badge trend-down";
                }
              }

              return (
                <div
                  className="simple-list-item"
                  key={`${item.journal_id}-${index}`}
                  style={{ alignItems: "flex-start" }}
                >
                  <div style={{ maxWidth: "80%" }}>
                    <strong>
                      {item.title && item.title.trim().length > 0
                        ? truncateText(item.title, 45)
                        : "Untitled Journal"}
                    </strong>
                    <p style={{ marginTop: "6px" }}>
                      {item.day}
                    </p>
                    <p style={{ marginTop: "4px" }}>
                      Emotion: <strong>{item.primary_emotion || "No data"}</strong> | Tone:{" "}
                      <strong>{item.tone || "No data"}</strong>
                    </p>
                  </div>

                  <span className={toxicityClass}>{toxicityLabel}</span>
                </div>
              );
            })}
          </div>
        ) : (
          <p>No journal timeline data available yet.</p>
        )}
      </section> 

      <section className="glass-card summary-section">
        <div className="section-head">
          <h3>Emotional Snapshot</h3>
        </div>

        <div className="summary-grid">
          <div className="summary-card">
            <p className="summary-alert">Posts</p>
            <p>
              <span className="summary-label">Dominant emotion this week:</span>
              <br />
              <strong>{snapshotPost?.dominant_primary_emotion_week || "No data"}</strong>
            </p>
            <p>
              <span className="summary-label">Trend:</span>
              <br />
              <strong>{buildSnapshotText(snapshotPost)}</strong>
            </p>
          </div>

          <div className="summary-card">
            <p className="summary-alert">Journals</p>
            <p>
              <span className="summary-label">Dominant emotion this week:</span>
              <br />
              <strong>
                {snapshotJournal?.dominant_primary_emotion_week || "No data"}
              </strong>
            </p>
            <p>
              <span className="summary-label">Trend:</span>
              <br />
              <strong>{buildSnapshotText(snapshotJournal)}</strong>
            </p>
          </div>

          <div className="summary-card">
            <p className="summary-alert">Comments</p>
            <p>
              <span className="summary-label">Dominant emotion this week:</span>
              <br />
              <strong>
                {snapshotComment?.dominant_primary_emotion_week || "No data"}
              </strong>
            </p>
            <p>
              <span className="summary-label">Trend:</span>
              <br />
              <strong>{buildSnapshotText(snapshotComment)}</strong>
            </p>
          </div>
        </div>
      </section>

      <TypeOverviewCard label="Posts" data={data?.by_type?.post} />
      <TypeOverviewCard label="Journals" data={data?.by_type?.journal} />
      <TypeOverviewCard label="Comments" data={data?.by_type?.comment} />
    </div>
  );
}