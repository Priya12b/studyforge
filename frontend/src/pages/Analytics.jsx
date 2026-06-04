import { useEffect, useState } from "react";
import toast from "react-hot-toast";

import Layout from "../components/Layout";
import LoadingSpinner from "../components/LoadingSpinner";
import API from "../services/api";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
} from "recharts";
import "../styles/analytics.css";

const Analytics = () => {
  const [analytics, setAnalytics] = useState(null);
  const [performance, setPerformance] = useState(null);
  const [loading, setLoading] = useState(true);
  const [perfLoading, setPerfLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await API.get("/analytics");
      setAnalytics(res.data);
      
      // Load AI performance recommendations
      fetchAIPerformance();
    } catch (err) {
      console.error("[Analytics] fetch failed:", err.message);
      setError("Failed to load analytics data");
    } finally {
      setLoading(false);
    }
  };

  const fetchAIPerformance = async () => {
    try {
      setPerfLoading(true);
      const res = await API.post("/analytics/performance", { days_to_analyze: 7 });
      setPerformance(res.data);
    } catch (err) {
      console.error("[Analytics] AI Performance failed:", err.message);
      // Don't crash the whole page if AI recommendations fail
    } finally {
      setPerfLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const data = analytics
    ? [
      {
        name: "Tasks",
        value: analytics.tasksCompleted ?? 0,
      },
      {
        name: "Study Hours",
        value: analytics.studyHours ?? 0,
      },
      {
        name: "Streak",
        value: analytics.streak ?? 0,
      },
    ]
    : [];

  return (
    <Layout>
      <div className="analytics-shell">
        <div>
          <span className="eyebrow">Performance Analytics Hub</span>
          <h1>Analytics & Insights</h1>
          <p className="muted">A visual summary of your study consistency, task completion and AI recommendations.</p>
        </div>

        {loading && <LoadingSpinner message="Loading your statistics..." />}

        {error && (
          <div className="error-card card">
            <p>{error}</p>
            <button className="btn-secondary" onClick={fetchAnalytics}>Retry</button>
          </div>
        )}

        {!loading && analytics && (
          <>
            <div className="analytics-grid">
              <div className="analytics-stat">
                <div className="stat-label">Tasks Completed</div>
                <div className="stat-value">{analytics.tasksCompleted ?? 0}</div>
              </div>
              <div className="analytics-stat">
                <div className="stat-label">Study Hours</div>
                <div className="stat-value">{analytics.studyHours ?? 0}</div>
              </div>
              <div className="analytics-stat">
                <div className="stat-label">Streak</div>
                <div className="stat-value">{analytics.streak ?? 0} days</div>
              </div>
              <div className="analytics-stat">
                <div className="stat-label">Weak Topics Count</div>
                <div className="stat-value">{analytics.weakTopics?.length ?? 0}</div>
              </div>
            </div>

            <div className="grid2" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: 24, marginTop: 24 }}>
              <div className="card analytics-chart-box">
                <h3 style={{ marginBottom: 14 }}>Core Activity</h3>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={data}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" />
                    <XAxis dataKey="name" tick={{ fill: "var(--muted)" }} />
                    <YAxis tick={{ fill: "var(--muted)" }} />
                    <Tooltip />
                    <Bar dataKey="value" fill="url(#analyticsFill)" radius={[12, 12, 0, 0]} />
                    <defs>
                      <linearGradient id="analyticsFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--accent)" />
                        <stop offset="100%" stopColor="var(--accent-2)" />
                      </linearGradient>
                    </defs>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Weak Topics List */}
              <div className="card">
                <h3>Weak Topics Detected</h3>
                <p className="muted" style={{ marginBottom: 14 }}>Topics flagged from incorrect quiz answers.</p>
                {analytics.weakTopics && analytics.weakTopics.length > 0 ? (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {analytics.weakTopics.map((topic, i) => (
                      <span key={i} className="badge" style={{ background: "rgba(239, 68, 68, 0.08)", color: "var(--danger)", border: "1px solid rgba(239, 68, 68, 0.15)" }}>
                        {topic}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="muted" style={{ fontStyle: "italic" }}>No weak topics detected yet. Complete some quizzes!</p>
                )}
              </div>
            </div>

            {/* AI Performance Analysis Section */}
            <section style={{ marginTop: 32 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <h2>AI Performance Analysis</h2>
                <button className="btn-secondary" onClick={fetchAIPerformance} disabled={perfLoading}>
                  {perfLoading ? "Analyzing..." : "Refresh Insights"}
                </button>
              </div>

              {perfLoading && <LoadingSpinner message="AI Agent is auditing your study logs and quiz performance..." />}

              {!perfLoading && performance && (
                <div className="grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 20 }}>
                  <div className="card" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <div className="stat-label">Productivity Score</div>
                    <div className="stat-value" style={{ color: "var(--accent)" }}>{performance.productivity_score}%</div>
                    <div className="progress-bar" style={{ width: "100%", height: 8, background: "var(--border)", borderRadius: 4, overflow: "hidden" }}>
                      <div style={{ width: `${performance.productivity_score}%`, height: "100%", background: "var(--accent)" }} />
                    </div>
                  </div>

                  <div className="card" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <div className="stat-label">Burnout Risk</div>
                    <div className="stat-value" style={{ color: performance.burnout_risk > 50 ? "var(--danger)" : "var(--success)" }}>
                      {performance.burnout_risk}%
                    </div>
                    <div className="progress-bar" style={{ width: "100%", height: 8, background: "var(--border)", borderRadius: 4, overflow: "hidden" }}>
                      <div style={{ width: `${performance.burnout_risk}%`, height: "100%", background: performance.burnout_risk > 50 ? "var(--danger)" : "var(--success)" }} />
                    </div>
                  </div>

                  <div className="card" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <div className="stat-label">Consistency Score</div>
                    <div className="stat-value" style={{ color: "var(--accent-2)" }}>{performance.consistency_score}%</div>
                    <div className="progress-bar" style={{ width: "100%", height: 8, background: "var(--border)", borderRadius: 4, overflow: "hidden" }}>
                      <div style={{ width: `${performance.consistency_score}%`, height: "100%", background: "var(--accent-2)" }} />
                    </div>
                  </div>

                  {performance.peak_hours && performance.peak_hours.length > 0 && (
                    <div className="card">
                      <div className="stat-label">Peak Study Hours</div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                        {performance.peak_hours.map((hour, idx) => (
                          <span key={idx} className="badge">{hour}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  {performance.recommendations && performance.recommendations.length > 0 && (
                    <div className="card" style={{ gridColumn: "1 / -1" }}>
                      <h3>AI Study Recommendations</h3>
                      <ul style={{ paddingLeft: 20, marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
                        {performance.recommendations.map((rec, idx) => (
                          <li key={idx} style={{ lineHeight: "1.4" }}>{rec}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {!perfLoading && !performance && (
                <div className="card" style={{ textAlign: "center", padding: 24 }}>
                  <p className="muted">AI performance report has not been requested yet or no logs are available.</p>
                  <button className="btn" onClick={fetchAIPerformance} style={{ marginTop: 12 }}>Run AI Analysis</button>
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </Layout>
  );
};

export default Analytics;