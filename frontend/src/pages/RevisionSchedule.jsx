import { useState } from "react";
import toast from "react-hot-toast";

import Layout from "../components/Layout";
import LoadingSpinner from "../components/LoadingSpinner";
import API from "../services/api";
import "../styles/revision.css";

const RevisionSchedule = () => {
  const [formData, setFormData] = useState({
    topics_input: "",
    daily_capacity_minutes: 120,
  });
  const [schedule, setSchedule] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleGenerate = async (e) => {
    e.preventDefault();
    if (!formData.topics_input.trim()) {
      toast.error("Please enter at least one topic you have studied");
      return;
    }

    setLoading(true);
    setError(null);
    setSchedule(null);

    // Split topics input by comma
    const topics_studied = formData.topics_input
      .split(",")
      .map(t => t.trim())
      .filter(t => t.length > 0)
      .map(topic => ({
        name: topic,
        confidence_level: 50,
        date_studied: new Date().toLocaleDateString("en-GB"),
      }));

    try {
      const res = await API.post("/revision/generate", {
        topics_studied,
        daily_capacity_minutes: formData.daily_capacity_minutes,
      });

      if (res.data) {
        setSchedule(res.data);
        toast.success("AI revision schedule successfully generated!");
      }
    } catch (err) {
      console.error("[Revision] Generation failed:", err.message);
      setError("Failed to generate revision schedule. Please check server connections.");
      toast.error("Could not generate schedule");
    } finally {
      setLoading(false);
    }
  };

  // Group revision blocks by date/review_date
  const groupedSchedule = {};
  if (schedule && schedule.revision_blocks) {
    schedule.revision_blocks.forEach((block) => {
      const date = block.review_date || block.date || "Next Session";
      if (!groupedSchedule[date]) {
        groupedSchedule[date] = [];
      }
      groupedSchedule[date].push(block);
    });
  }

  return (
    <Layout>
      <div className="revision-container">
        <section>
          <span className="eyebrow">Spaced Repetition Engine</span>
          <h1>Revision Planner</h1>
          <p className="muted">
            Input recently studied topics and daily capacity to generate an optimized spaced repetition schedule.
          </p>
        </section>

        <form onSubmit={handleGenerate} className="revision-form surface page-card card">
          <div className="grid" style={{ gap: 16 }}>
            <div>
              <label className="stat-label">Topics Studied (comma separated)</label>
              <input
                type="text"
                name="topics_input"
                placeholder="e.g. Gravitation, Calculus Limits, Macroeconomics Inflation"
                className="input"
                value={formData.topics_input}
                onChange={handleChange}
                required
                style={{ width: "100%", marginTop: 4 }}
              />
            </div>

            <div>
              <label className="stat-label">Daily Capacity (Minutes): {formData.daily_capacity_minutes}</label>
              <input
                type="range"
                name="daily_capacity_minutes"
                min="30"
                max="240"
                step="15"
                className="input"
                value={formData.daily_capacity_minutes}
                onChange={handleChange}
                style={{ width: "100%", marginTop: 8, padding: 0 }}
              />
            </div>
          </div>

          <button type="submit" className="btn" disabled={loading} style={{ marginTop: 10 }}>
            {loading ? "Calculating Timeline..." : "Generate Revision Schedule"}
          </button>
        </form>

        {loading && <LoadingSpinner message="AI is crunching forgetting curves to build your spaced repetition plan..." />}

        {error && (
          <div className="error-card card">
            <p>{error}</p>
            <button className="btn-secondary" onClick={handleGenerate}>Retry</button>
          </div>
        )}

        {schedule && (
          <div>
            {schedule.strategy_description && (
              <div className="revision-strategy-box">
                <span className="eyebrow" style={{ color: "var(--accent)" }}>AI Spaced Repetition Strategy</span>
                <p style={{ marginTop: 6, fontWeight: 500 }}>{schedule.strategy_description}</p>
              </div>
            )}

            <h2>Your Revision Timeline</h2>

            <div className="revision-list">
              {Object.keys(groupedSchedule).length === 0 ? (
                <p className="muted">No schedule items. Try adjusting inputs.</p>
              ) : (
                Object.keys(groupedSchedule).sort().map((date) => (
                  <div key={date} className="revision-group">
                    <div className="revision-group-header">
                      {new Date(date.split("/").reverse().join("-")).toLocaleDateString(undefined, {
                        weekday: "long",
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}
                    </div>
                    {groupedSchedule[date].map((item, idx) => (
                      <div key={idx} className="revision-card">
                        <div className="revision-card-body">
                          <h4>{item.topic || item.name || "Revision Block"}</h4>
                          <div className="revision-card-meta">
                            <span className="badge">Duration: {item.duration_minutes || 30} mins</span>
                            <span className="badge">Interval: {item.interval_days || 1}d</span>
                            {item.confidence_level && (
                              <span className="badge">Confidence: {item.confidence_level}%</span>
                            )}
                          </div>
                        </div>
                        {item.recommended_activity && (
                          <div style={{ fontSize: "0.85rem", color: "var(--muted)", maxWidth: 300, textAlign: "right" }}>
                            <strong>Activity:</strong> {item.recommended_activity}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {!loading && !schedule && !error && (
          <div style={{ padding: 40, textAlign: "center" }} className="muted">
            No schedule generated yet. Enter topics to create a personalized forgetting-curve recovery plan.
          </div>
        )}
      </div>
    </Layout>
  );
};

export default RevisionSchedule;
