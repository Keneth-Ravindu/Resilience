import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import api from "../../api/client";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
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

function TrendBadge({ value }) {
  const cls =
    value === "up"
      ? "trend-up"
      : value === "down"
      ? "trend-down"
      : "trend-stable";

  return <span className={`trend-badge ${cls}`}>{value}</span>;
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
              <strong>{item.avg}</strong>
            </div>
          ))}
        </div>
      ) : (
        <p>No data available.</p>
      )}
    </section>
  );
}

function TypeAnalyticsCard({ label, data }) {
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
                <Tooltip />
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

export default function MenteeAnalytics() {
  const { menteeId } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        setLoading(true);
        setError("");

        const res = await api.get(`/mentors/${menteeId}/analytics`, {
          params: {
            days: 30,
            window: 7,
            top_n: 3,
            include_series: true,
            debug: true,
          },
        });

        setData(res.data);
      } catch {
        setError("Failed to load mentee analytics.");
      } finally {
        setLoading(false);
      }
    };

    if (menteeId) {
      fetchAnalytics();
    }
  }, [menteeId]);

  if (loading) {
    return (
      <div className="fade-in">
        <h2 className="page-title">Mentee Analytics</h2>
        <section className="glass-card">
          <p>Loading analytics...</p>
        </section>
      </div>
    );
  }

  if (error) {
    return (
      <div className="fade-in">
        <h2 className="page-title">Mentee Analytics</h2>
        <p className="error-text">{error}</p>
      </div>
    );
  }

  return (
    <div className="fade-in">
      <div className="analytics-page-head">
        <div>
          <h2 className="page-title">Mentee Analytics</h2>
          <p className="page-subtitle">
            Viewing read-only analytics for mentee #{menteeId}
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
        </div>
      </div>

      <TypeAnalyticsCard label="Posts" data={data?.by_type?.post} />
      <TypeAnalyticsCard label="Journals" data={data?.by_type?.journal} />
      <TypeAnalyticsCard label="Comments" data={data?.by_type?.comment} />
    </div>
  );
}