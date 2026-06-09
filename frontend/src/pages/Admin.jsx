import { useEffect, useState } from "react";
import toast from "react-hot-toast";

import Layout from "../components/Layout";
import LoadingSpinner from "../components/LoadingSpinner";
import API from "../services/api";
import "../styles/admin.css";

const Admin = () => {
  const [activeTab, setActiveTab] = useState("overview");
  const [loadingMetrics, setLoadingMetrics] = useState(true);
  const [loadingSettings, setLoadingSettings] = useState(false);
  const [metrics, setMetrics] = useState(null);
  const [settings, setSettings] = useState({
    STUDY_PLANNER_PROMPT_SYSTEM: "",
    AI_TUTOR_PROMPT_SYSTEM: "",
    QUIZ_GENERATOR_PROMPT_SYSTEM: "",
  });

  const fetchMetrics = async () => {
    try {
      setLoadingMetrics(true);
      const res = await API.get("/admin/metrics");
      setMetrics(res.data);
    } catch (error) {
      console.error("[Admin Metrics] Fetch failed:", error.message);
      toast.error("Failed to load admin metrics");
    } finally {
      setLoadingMetrics(false);
    }
  };

  const fetchSettings = async () => {
    try {
      setLoadingSettings(true);
      const res = await API.get("/admin/settings");
      if (res.data.settings) {
        setSettings(res.data.settings);
      }
    } catch (error) {
      console.error("[Admin Settings] Fetch failed:", error.message);
      toast.error("Failed to load prompt configuration settings");
    } finally {
      setLoadingSettings(false);
    }
  };

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    try {
      setLoadingSettings(true);
      await API.post("/admin/settings", { settings });
      toast.success("Prompt templates updated successfully!");
    } catch (error) {
      console.error("[Admin Settings] Save failed:", error.message);
      toast.error("Failed to save settings");
    } finally {
      setLoadingSettings(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
    fetchSettings();
  }, []);

  const formatUptime = (seconds) => {
    if (!seconds) return "0s";
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    return `${hrs}h ${mins}m ${secs}s`;
  };

  return (
    <Layout>
      <div className="admin-shell">
        <section className="admin-hero">
          <span className="eyebrow">Control Center</span>
          <h1>Admin Dashboard</h1>
          <p className="muted">
            Monitor system diagnostics, analyze user activity, and configure AI prompt templates.
          </p>
        </section>

        <div className="admin-tabs">
          <button
            className={`admin-tab-btn ${activeTab === "overview" ? "active" : ""}`}
            onClick={() => setActiveTab("overview")}
          >
            Overview & Diagnostics
          </button>
          <button
            className={`admin-tab-btn ${activeTab === "users" ? "active" : ""}`}
            onClick={() => setActiveTab("users")}
          >
            User Management ({metrics?.users?.length || 0})
          </button>
          <button
            className={`admin-tab-btn ${activeTab === "prompts" ? "active" : ""}`}
            onClick={() => setActiveTab("prompts")}
          >
            Prompt Configurations
          </button>
        </div>

        {activeTab === "overview" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
            {loadingMetrics ? (
              <LoadingSpinner message="Loading system metrics..." />
            ) : (
              <>
                {/* Usage Counters */}
                <div className="admin-grid">
                  <div className="admin-card">
                    <span className="eyebrow">Total Platform Reach</span>
                    <h3>{metrics?.metrics?.totalUsers || 0}</h3>
                    <p className="muted">Registered Students</p>
                  </div>
                  <div className="admin-card">
                    <span className="eyebrow">Intellectual Asset Count</span>
                    <h3>{metrics?.metrics?.totalNotes || 0}</h3>
                    <p className="muted">Note & Document Uploads</p>
                  </div>
                  <div className="admin-card">
                    <span className="eyebrow">Knowledge Tests</span>
                    <h3>{metrics?.metrics?.totalQuizzes || 0}</h3>
                    <p className="muted">Quizzes Generated & Solved</p>
                  </div>
                </div>

                {/* System Diagnostics */}
                <div className="admin-grid">
                  <div className="admin-card">
                    <h3>Environment & Server</h3>
                    <div style={{ marginTop: "12px", display: "flex", flexDirection: "column", gap: "8px" }}>
                      <div>
                        <strong>Mode:</strong> <span className="status-badge online" style={{ padding: "2px 8px" }}>{metrics?.system?.serverEnv}</span>
                      </div>
                      <div>
                        <strong>Uptime:</strong> {formatUptime(metrics?.system?.uptimeSeconds)}
                      </div>
                    </div>
                  </div>

                  <div className="admin-card">
                    <h3>AI Orchestrator Status</h3>
                    <div style={{ marginTop: "12px", display: "flex", flexDirection: "column", gap: "8px" }}>
                      <div>
                        <strong>Service Connection:</strong>{" "}
                        <span className={`status-badge ${metrics?.system?.aiService?.status === "offline" ? "offline" : "online"}`}>
                          {metrics?.system?.aiService?.status || "online"}
                        </span>
                      </div>
                      {metrics?.system?.aiService?.version && (
                        <div>
                          <strong>Version:</strong> {metrics?.system?.aiService?.version}
                        </div>
                      )}
                      {metrics?.system?.aiService?.active_sessions !== undefined && (
                        <div>
                          <strong>Active Conversations:</strong> {metrics?.system?.aiService?.active_sessions}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="admin-card">
                    <h3>Healthy AI Providers</h3>
                    <div className="provider-list">
                      {metrics?.system?.aiService?.providers ? (
                        Object.entries(metrics.system.aiService.providers).map(([name, healthy]) => (
                          <div key={name} className="provider-item">
                            <span style={{ fontWeight: "600", textTransform: "capitalize" }}>{name}</span>
                            <span className={`status-badge ${healthy ? "online" : "offline"}`}>
                              {healthy ? "Available" : "Offline"}
                            </span>
                          </div>
                        ))
                      ) : (
                        <p className="muted">No providers status available</p>
                      )}
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {activeTab === "users" && (
          <div className="admin-table-container">
            {loadingMetrics ? (
              <LoadingSpinner message="Retrieving users..." />
            ) : (
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Auth Method</th>
                    <th>Registration Date</th>
                  </tr>
                </thead>
                <tbody>
                  {metrics?.users?.map((user) => (
                    <tr key={user._id}>
                      <td style={{ fontWeight: "600" }}>{user.name}</td>
                      <td>{user.email}</td>
                      <td>
                        <span
                          className="status-badge"
                          style={{
                            backgroundColor: user.role === "admin" ? "rgba(139, 92, 246, 0.15)" : "rgba(59, 130, 246, 0.15)",
                            color: user.role === "admin" ? "#8b5cf6" : "#3b82f6",
                            border: user.role === "admin" ? "1px solid rgba(139, 92, 246, 0.3)" : "1px solid rgba(59, 130, 246, 0.3)",
                          }}
                        >
                          {user.role}
                        </span>
                      </td>
                      <td style={{ textTransform: "uppercase", fontSize: "0.8rem", fontWeight: "600" }}>
                        {user.authProvider || "local"}
                      </td>
                      <td>{new Date(user.createdAt).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {activeTab === "prompts" && (
          <div>
            {loadingSettings ? (
              <LoadingSpinner message="Loading configuration templates..." />
            ) : (
              <form className="settings-form" onSubmit={handleSaveSettings}>
                <div className="settings-group">
                  <label htmlFor="plannerPrompt">Study Planner System Prompt</label>
                  <textarea
                    id="plannerPrompt"
                    className="settings-textarea"
                    value={settings.STUDY_PLANNER_PROMPT_SYSTEM}
                    onChange={(e) =>
                      setSettings({ ...settings, STUDY_PLANNER_PROMPT_SYSTEM: e.target.value })
                    }
                    placeholder="Enter base prompt override for the Study Planner Agent..."
                  />
                </div>

                <div className="settings-group">
                  <label htmlFor="tutorPrompt">AI Tutor System Prompt</label>
                  <textarea
                    id="tutorPrompt"
                    className="settings-textarea"
                    value={settings.AI_TUTOR_PROMPT_SYSTEM}
                    onChange={(e) =>
                      setSettings({ ...settings, AI_TUTOR_PROMPT_SYSTEM: e.target.value })
                    }
                    placeholder="Enter base prompt override for the AI Tutor Agent..."
                  />
                </div>

                <div className="settings-group">
                  <label htmlFor="quizPrompt">Quiz Generator System Prompt</label>
                  <textarea
                    id="quizPrompt"
                    className="settings-textarea"
                    value={settings.QUIZ_GENERATOR_PROMPT_SYSTEM}
                    onChange={(e) =>
                      setSettings({ ...settings, QUIZ_GENERATOR_PROMPT_SYSTEM: e.target.value })
                    }
                    placeholder="Enter base prompt override for the Quiz Generator Agent..."
                  />
                </div>

                <button type="submit" className="btn" style={{ width: "max-content", marginTop: "12px" }}>
                  Save Custom Prompt Templates
                </button>
              </form>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
};

export default Admin;
