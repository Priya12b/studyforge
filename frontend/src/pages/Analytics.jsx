import {
  useEffect,
  useState,
} from "react";

import Layout from "../components/Layout";
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
  const [analytics, setAnalytics] =
    useState(null);

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        const res = await API.get("/analytics");
        setAnalytics(res.data);
      } catch (error) {
        console.log(error);
      }
    };

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
          <span className="eyebrow">Performance Analytics</span>
          <h1>Analytics</h1>
          <p className="muted">A visual summary of your learning consistency, task completion and streak growth.</p>
        </div>

        {analytics && (
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
              <div className="stat-value">{analytics.streak ?? 0}</div>
            </div>
            <div className="analytics-stat">
              <div className="stat-label">Weak Topics</div>
              <div className="stat-value">{analytics.weakTopics?.length ?? 0}</div>
            </div>
          </div>
        )}

        <div className="analytics-chart">
          <ResponsiveContainer width="100%" height={320}>
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
      </div>
    </Layout>
  );
};

export default Analytics;