import {
  useEffect,
  useState,
} from "react";
import { Link } from "react-router-dom";

import Layout from "../components/Layout";
import LoadingSpinner from "../components/LoadingSpinner";
import API from "../services/api";
import "../styles/dashboard.css";

const Dashboard = () => {
  const [data, setData] =
    useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchDashboard = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await API.get("/dashboard");
      setData(res.data.data);
    } catch (error) {
      console.error("[Dashboard] Failed to load:", error.message);
      setError("Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  return (
    <Layout>
      <div className="dashboard-shell">
        <section className="dashboard-hero">
          <div>
            <span className="eyebrow">Adaptive Study Dashboard</span>
            <h1>Dashboard</h1>
            <p className="dashboard-copy">
              Track tasks, quizzes, productivity and adaptive learning insights in one place.
            </p>
          </div>
        </section>

        <div className="grid cards">
          <Link to="/planner" className="card">
            <div className="stat-label">Study Planner</div>
            <h3>Generate a new plan</h3>
            <p className="muted">Create personalized daily learning paths in seconds.</p>
          </Link>

          <Link to="/tasks" className="card">
            <div className="stat-label">Tasks</div>
            <h3>Manage your workload</h3>
            <p className="muted">Add, complete, prioritize and delete study tasks.</p>
          </Link>

          <Link to="/quiz" className="card">
            <div className="stat-label">Quiz Studio</div>
            <h3>Test understanding</h3>
            <p className="muted">Generate adaptive quizzes and analyze weak topics.</p>
          </Link>

          <Link to="/notes" className="card">
            <div className="stat-label">PDF Notes</div>
            <h3>Upload study notes</h3>
            <p className="muted">Summarize PDFs, generate quizzes and build plans.</p>
          </Link>

          <Link to="/flashcards" className="card">
            <div className="stat-label">Flashcards</div>
            <h3>Study with flashcards</h3>
            <p className="muted">Generate AI-powered flashcards for quick revision.</p>
          </Link>

          <Link to="/attendance" className="card">
            <div className="stat-label">Attendance</div>
            <h3>Track daily check-ins</h3>
            <p className="muted">Record presence, late entries and weekly attendance streaks.</p>
          </Link>

          <Link to="/gamification" className="card">
            <div className="stat-label">Gamification</div>
            <h3>Earn XP and badges</h3>
            <p className="muted">Track streaks, climb levels and compete on the leaderboard.</p>
          </Link>

          <Link to="/chatbot" className="card">
            <div className="stat-label">Chatbot</div>
            <h3>Ask study questions</h3>
            <p className="muted">Get quick AI-guided study replies from your main app.</p>
          </Link>
        </div>

        {loading && <LoadingSpinner message="Loading dashboard data..." />}

        {error && (
          <div className="error-card">
            <p>{error}</p>
            <button className="btn-secondary" onClick={fetchDashboard}>Retry</button>
          </div>
        )}

        {data && (
          <section className="dashboard-stats">
            <div className="stat">
              <div className="stat-label">Total Tasks</div>
              <div className="stat-value">{data.tasks.totalTasks}</div>
            </div>
            <div className="stat">
              <div className="stat-label">Completed Tasks</div>
              <div className="stat-value">{data.tasks.completedTasks}</div>
            </div>
            <div className="stat">
              <div className="stat-label">Pending Tasks</div>
              <div className="stat-value">
                {data.tasks.totalTasks - data.tasks.completedTasks}
              </div>
            </div>
            <div className="stat">
              <div className="stat-label">Total Quizzes</div>
              <div className="stat-value">{data.quizzes.totalQuizzes}</div>
            </div>
            <div className="stat">
              <div className="stat-label">Average Quiz Score</div>
              <div className="stat-value">{Number(data.quizzes.averageScore || 0).toFixed(1)}</div>
            </div>
            <div className="stat">
              <div className="stat-label">Study Plans</div>
              <div className="stat-value">{data.studyPlans.totalPlans}</div>
            </div>

            <div className="stat">
              <div className="stat-label">Attendance Days</div>
              <div className="stat-value">{data.attendance?.summary?.totalDays || 0}</div>
            </div>

            <div className="stat">
              <div className="stat-label">Attendance Streak</div>
              <div className="stat-value">{data.attendance?.summary?.streak || 0}</div>
            </div>
          </section>
        )}
      </div>
    </Layout>
  );
};

export default Dashboard;