import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import Layout from "../components/Layout";
import LoadingSpinner from "../components/LoadingSpinner";
import API from "../services/api";
import "../styles/coach.css";

const Coach = () => {
  const [history, setHistory] = useState([]);
  const [selectedReport, setSelectedReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [checkedActions, setCheckedActions] = useState({});

  const fetchHistory = async (selectLatest = true) => {
    try {
      setLoading(true);
      const res = await API.get("/coach/history");
      setHistory(res.data.data);
      if (selectLatest && res.data.data.length > 0) {
        setSelectedReport(res.data.data[0]);
      }
    } catch (err) {
      console.error("[Coach] Fetch history failed:", err.message);
      toast.error("Failed to load coaching history");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const handleGenerate = async () => {
    try {
      setGenerating(true);
      toast.loading("AI Coach is auditing your learning metrics...", { id: "coach" });
      
      // Get AI preferences if saved in localStorage
      const provider = localStorage.getItem("activeProvider");
      const model = localStorage.getItem("activeModel");

      const res = await API.post("/coach/advice", { provider, model });
      toast.success("AI coaching report generated!", { id: "coach" });
      
      const newReport = res.data.data;
      setHistory((prev) => [newReport, ...prev]);
      setSelectedReport(newReport);
      setCheckedActions({});
    } catch (err) {
      console.error("[Coach] Generate failed:", err.message);
      toast.error(err.response?.data?.message || "Failed to generate coaching insights", { id: "coach" });
    } finally {
      setGenerating(false);
    }
  };

  const toggleAction = (idx) => {
    setCheckedActions((prev) => ({
      ...prev,
      [idx]: !prev[idx],
    }));
  };

  return (
    <Layout>
      <div className="coach-shell">
        <section className="coach-hero">
          <div>
            <span className="eyebrow">Interactive Study Advisor</span>
            <h1>AI Study Coach</h1>
            <p className="hero-copy">
              Actionable advice compiled by reviewing your study habits, quiz history, weak topics, and task lists.
            </p>
          </div>
          <button
            className="btn"
            onClick={handleGenerate}
            disabled={generating}
            style={{ alignSelf: "center" }}
          >
            {generating ? "Assessing..." : "Generate Coaching Report"}
          </button>
        </section>

        {loading ? (
          <LoadingSpinner message="Retrieving your coaching records..." />
        ) : (
          <div className="coach-workspace">
            {/* Left Sidebar: Reports Timeline */}
            <aside className="coach-sidebar card">
              <h3>Report History</h3>
              <p className="muted" style={{ marginBottom: 16, fontSize: "0.9rem" }}>
                Select an assessment to review details.
              </p>
              {history.length === 0 ? (
                <div style={{ textAlign: "center", padding: "20px 0" }}>
                  <p className="muted" style={{ fontSize: "0.85rem", fontStyle: "italic" }}>
                    No reports generated yet.
                  </p>
                </div>
              ) : (
                <div className="reports-list">
                  {history.map((report) => (
                    <button
                      key={report._id}
                      className={`report-item ${selectedReport?._id === report._id ? "active" : ""}`}
                      onClick={() => {
                        setSelectedReport(report);
                        setCheckedActions({});
                      }}
                    >
                      <div className="report-item-title">Coaching Report</div>
                      <div className="report-item-date">
                        {new Date(report.createdAt).toLocaleDateString()} at{" "}
                        {new Date(report.createdAt).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </aside>

            {/* Main Panel: Selected Report Details */}
            <main className="coach-main-panel">
              {selectedReport ? (
                <div className="report-details animate-fade">
                  <div className="report-header">
                    <h2>Academic Audit Details</h2>
                    <span className="report-date-badge">
                      Generated {new Date(selectedReport.createdAt).toLocaleDateString()}
                    </span>
                  </div>

                  {/* Coach Message Bubble Card */}
                  <div className="card coach-bubble-card">
                    <div className="coach-avatar-badge">💡</div>
                    <div className="coach-bubble-content">
                      <div className="coach-title">Coaching Guidance:</div>
                      <p className="coach-message">{selectedReport.coachMessage}</p>
                    </div>
                  </div>

                  <div className="report-subgrid">
                    {/* Priority Actions Card */}
                    <div className="card action-items-card">
                      <h3>Priority Actions</h3>
                      <p className="muted" style={{ marginBottom: 16 }}>
                        Recommended tasks for your current study cycle.
                      </p>
                      {selectedReport.priorityActions && selectedReport.priorityActions.length > 0 ? (
                        <ul className="action-checklist">
                          {selectedReport.priorityActions.map((action, idx) => (
                            <li
                              key={idx}
                              className={`action-checklist-item ${checkedActions[idx] ? "completed" : ""}`}
                              onClick={() => toggleAction(idx)}
                            >
                              <div className="checkbox">
                                {checkedActions[idx] && <span className="check">✓</span>}
                              </div>
                              <span className="action-text">{action}</span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="muted" style={{ fontStyle: "italic" }}>
                          No specific actions flagged for this period. Keep up the good work!
                        </p>
                      )}
                    </div>

                    {/* Daily Study Tip Card */}
                    <div className="card study-tip-card">
                      <div className="tip-header">
                        <span className="tip-icon">✨</span>
                        <h3>Coaching Daily Tip</h3>
                      </div>
                      <p className="tip-content">{selectedReport.studyTip || "Make sure to study in focused, distraction-free sessions of 25 minutes using the Pomodoro tool."}</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="card coach-empty-state">
                  <div className="empty-icon">📊</div>
                  <h2>No Coaching Report Selected</h2>
                  <p className="muted" style={{ maxWidth: 460, margin: "8px auto 20px" }}>
                    Click the "Generate Coaching Report" button above. The coach will analyze your completed tasks, quiz history, streaks, and weak topics to write custom study tips and priority actions.
                  </p>
                  <button className="btn" onClick={handleGenerate} disabled={generating}>
                    {generating ? "Generating..." : "Generate Your First Report"}
                  </button>
                </div>
              )}
            </main>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default Coach;
