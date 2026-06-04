import { useState, useEffect } from "react";
import toast from "react-hot-toast";

import Layout from "../components/Layout";
import API from "../services/api";

import "../styles/planner.css";

const Planner = () => {
  // Tabs state
  const [activeTab, setActiveTab] = useState("create"); // "create" or "history"
  const [history, setHistory] = useState([]);

  // Overall plan settings states
  const [startDate, setStartDate] = useState(new Date().toISOString().split("T")[0]);
  const [endDate, setEndDate] = useState(
    new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0]
  );
  const [hoursPerDay, setHoursPerDay] = useState(4);
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("21:00");
  const [breakDuration, setBreakDuration] = useState(15);
  const [goals, setGoals] = useState("");

  // Subjects builder states
  const [subjectsList, setSubjectsList] = useState([]);
  const [subjectName, setSubjectName] = useState("");
  const [subjectTopics, setSubjectTopics] = useState("");
  const [confidence, setConfidence] = useState(50);
  const [priority, setPriority] = useState("medium");
  const [credits, setCredits] = useState(3);
  const [examDate, setExamDate] = useState("");

  // Generated Plan & Loading states
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(false);
  const [activeDayIndex, setActiveDayIndex] = useState(0);

  // Fetch latest study plan on mount
  useEffect(() => {
    const fetchLatestPlan = async () => {
      try {
        setLoading(true);
        const res = await API.get("/planner/latest");
        if (res.data.success && res.data.data?.generatedPlan) {
          setPlan(res.data.data.generatedPlan);
        }
      } catch (error) {
        console.log("Failed to fetch latest plan:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchLatestPlan();
  }, []);

  const fetchHistory = async () => {
    try {
      setLoading(true);
      const res = await API.get("/planner/history");
      if (res.data.success) {
        setHistory(res.data.data);
      }
    } catch (error) {
      console.log("Failed to fetch history:", error);
      toast.error("Could not load planner history");
    } finally {
      setLoading(false);
    }
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    if (tab === "history") {
      fetchHistory();
    }
  };

  const viewPlanDetails = async (id) => {
    try {
      setLoading(true);
      const res = await API.get(`/planner/${id}`);
      if (res.data.success && res.data.data?.generatedPlan) {
        setPlan(res.data.data.generatedPlan);
        setActiveTab("create");
        setActiveDayIndex(0);
        toast.success("Loaded selected study plan");
      }
    } catch (error) {
      console.log("Failed to load plan:", error);
      toast.error("Could not fetch plan details");
    } finally {
      setLoading(false);
    }
  };

  const deletePlan = async (id) => {
    if (!window.confirm("Are you sure you want to delete this study plan?")) {
      return;
    }
    try {
      setLoading(true);
      await API.delete(`/planner/${id}`);
      toast.success("Study plan deleted");
      fetchHistory();
    } catch (error) {
      console.log("Failed to delete plan:", error);
      toast.error("Could not delete plan");
    } finally {
      setLoading(false);
    }
  };

  // Add subject to list
  const addSubject = () => {
    if (!subjectName.trim()) {
      toast.error("Subject name cannot be empty");
      return;
    }

    // Topics parse (comma-separated)
    const topicsArr = subjectTopics
      .split(",")
      .map((t) => t.trim())
      .filter((t) => t !== "");

    if (topicsArr.length === 0) {
      toast.error("Please enter at least one topic");
      return;
    }

    const newSubject = {
      name: subjectName.trim(),
      confidence_level: Number(confidence),
      priority,
      credits: Number(credits),
      exam_date: examDate || null,
      syllabus_topics: topicsArr,
    };

    setSubjectsList([...subjectsList, newSubject]);

    // Reset subject inputs
    setSubjectName("");
    setSubjectTopics("");
    setConfidence(50);
    setPriority("medium");
    setCredits(3);
    setExamDate("");

    toast.success(`Added ${newSubject.name} to plan list`);
  };

  const removeSubject = (index) => {
    const updated = subjectsList.filter((_, i) => i !== index);
    setSubjectsList(updated);
  };

  const generatePlan = async () => {
    if (subjectsList.length === 0) {
      toast.error("Please add at least one subject to generate a study plan");
      return;
    }

    setLoading(true);
    setPlan(null);

    try {
      const payload = {
        subjects: subjectsList,
        available_hours_per_day: Number(hoursPerDay),
        start_date: startDate,
        end_date: endDate,
        preferred_start_time: startTime,
        preferred_end_time: endTime,
        break_duration_minutes: Number(breakDuration),
        goals: goals.trim() || null,
        provider: localStorage.getItem("activeProvider") || "gemini",
        model: localStorage.getItem("activeModel") || "google/gemini-2.5-flash",
      };

      const res = await API.post("/planner/generate", payload);
      if (res.data.success && res.data.data?.generatedPlan) {
        setPlan(res.data.data.generatedPlan);
        setActiveDayIndex(0);
        toast.success("Study plan generated successfully!");
      } else {
        toast.error("Invalid response from server");
      }
    } catch (error) {
      console.log(error);
      toast.error(error.response?.data?.message || "Planner generation failed");
    } finally {
      setLoading(false);
    }
  };

  const resetPlanSettings = () => {
    setPlan(null);
    setSubjectsList([]);
  };

  return (
    <Layout>
      <div className="planner-container">
        <section className="planner-hero-section" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <span className="eyebrow">AI Study Planner</span>
            <h1>Custom Study Orchestrator</h1>
            <p className="muted">
              Configure your study hours, breaks, exam dates, confidence levels and syllabus. Our multi-agent AI will design the optimal roadmap.
            </p>
          </div>
          <div className="tabs-navigation" style={{ display: "flex", gap: 10 }}>
            <button
              onClick={() => handleTabChange("create")}
              className={`btn ${activeTab === "create" ? "btn-primary" : "btn-secondary"}`}
            >
              Orchestrate
            </button>
            <button
              onClick={() => handleTabChange("history")}
              className={`btn ${activeTab === "history" ? "btn-primary" : "btn-secondary"}`}
            >
              Plan History
            </button>
          </div>
        </section>

        {loading && (
          <div className="planner-loading-state surface">
            <div className="loading-orbit">
              <div className="orbit-core">AI</div>
              <div className="orbit-ring"></div>
            </div>
            <h3>Orchestrating Study Roadmap...</h3>
            <p className="muted">
              We are consulting learning agents to build day-wise slots, balance priority, and schedules.
            </p>
          </div>
        )}

        {!loading && activeTab === "history" && (
          <div className="planner-history-container">
            <h2>Saved Study Plans</h2>
            <div className="history-list" style={{ display: "flex", flexDirection: "column", gap: 16, marginTop: 16 }}>
              {history.length === 0 ? (
                <p className="muted">No study plans created yet.</p>
              ) : (
                history.map((hPlan) => (
                  <div key={hPlan._id} className="card" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <h4 style={{ margin: 0 }}>{hPlan.subject}</h4>
                      <p className="muted" style={{ margin: "4px 0 0 0", fontSize: "0.85rem" }}>
                        Topic: {hPlan.topic || "N/A"} • Created: {new Date(hPlan.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button className="btn btn-secondary" onClick={() => viewPlanDetails(hPlan._id)}>
                        View
                      </button>
                      <button className="btn" style={{ background: "rgba(239, 68, 68, 0.1)", color: "var(--danger)" }} onClick={() => deletePlan(hPlan._id)}>
                        Delete
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {!loading && activeTab === "create" && (
          <>
            {!plan && (
              <div className="planner-workspace-grid">
                {/* Left: Overall settings */}
                <div className="planner-settings-sidebar surface card">
                  <h3>1. Schedule Configuration</h3>
                  <p className="muted text-sm">Define your availability windows and dates</p>

                  <div className="settings-form">
                    <div className="fields-row">
                      <div className="field-group">
                        <label className="field-label">Start Date</label>
                        <input
                          type="date"
                          className="input"
                          value={startDate}
                          onChange={(e) => setStartDate(e.target.value)}
                        />
                      </div>
                      <div className="field-group">
                        <label className="field-label">End Date</label>
                        <input
                          type="date"
                          className="input"
                          value={endDate}
                          onChange={(e) => setEndDate(e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="field-group">
                      <label className="field-label">Daily Study Hours: {hoursPerDay} hrs</label>
                      <input
                        type="range"
                        min="1"
                        max="16"
                        className="slider-input"
                        value={hoursPerDay}
                        onChange={(e) => setHoursPerDay(Number(e.target.value))}
                      />
                      <div className="slider-limits">
                        <span>1 hr</span>
                        <span>16 hrs</span>
                      </div>
                    </div>

                    <div className="fields-row">
                      <div className="field-group">
                        <label className="field-label">Preferred Start Time</label>
                        <input
                          type="time"
                          className="input"
                          value={startTime}
                          onChange={(e) => setStartTime(e.target.value)}
                        />
                      </div>
                      <div className="field-group">
                        <label className="field-label">Preferred End Time</label>
                        <input
                          type="time"
                          className="input"
                          value={endTime}
                          onChange={(e) => setEndTime(e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="field-group">
                      <label className="field-label">Break Duration</label>
                      <select
                        className="select"
                        value={breakDuration}
                        onChange={(e) => setBreakDuration(Number(e.target.value))}
                      >
                        <option value={5}>5 Minutes</option>
                        <option value={10}>10 Minutes</option>
                        <option value={15}>15 Minutes</option>
                        <option value={20}>20 Minutes</option>
                        <option value={30}>30 Minutes</option>
                      </select>
                    </div>

                    <div className="field-group">
                      <label className="field-label">Focus / Custom Goal (Optional)</label>
                      <textarea
                        className="textarea"
                        placeholder="e.g. Focus on revision, practice problems, prepare for midterms next week..."
                        rows={3}
                        value={goals}
                        onChange={(e) => setGoals(e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                {/* Right: Subject Builder & List */}
                <div className="planner-main-panel surface card">
                  <h3>2. Add Subjects & Topics</h3>
                  <p className="muted text-sm">Add subjects you want to cover in this plan</p>

                  <div className="subject-builder-box">
                    <div className="fields-row">
                      <div className="field-group">
                        <label className="field-label">Subject Name</label>
                        <input
                          type="text"
                          className="input"
                          placeholder="e.g. Physics, Data Structures"
                          value={subjectName}
                          onChange={(e) => setSubjectName(e.target.value)}
                        />
                      </div>
                      <div className="field-group">
                        <label className="field-label">Course Credits</label>
                        <input
                          type="number"
                          min="1"
                          className="input"
                          value={credits}
                          onChange={(e) => setCredits(Number(e.target.value))}
                        />
                      </div>
                    </div>

                    <div className="field-group">
                      <label className="field-label">Syllabus Topics (comma-separated)</label>
                      <input
                        type="text"
                        className="input"
                        placeholder="e.g. Thermodynamics, Kinematics, Wave Optics"
                        value={subjectTopics}
                        onChange={(e) => setSubjectTopics(e.target.value)}
                      />
                    </div>

                    <div className="fields-row items-center">
                      <div className="field-group">
                        <label className="field-label">Exam Date (Optional)</label>
                        <input
                          type="date"
                          className="input"
                          value={examDate}
                          onChange={(e) => setExamDate(e.target.value)}
                        />
                      </div>
                      <div className="field-group">
                        <label className="field-label">Subject Priority</label>
                        <select
                          className="select"
                          value={priority}
                          onChange={(e) => setPriority(e.target.value)}
                        >
                          <option value="low">Low</option>
                          <option value="medium">Medium</option>
                          <option value="high">High</option>
                          <option value="critical">Critical</option>
                        </select>
                      </div>
                    </div>

                    <div className="field-group slider-field">
                      <label className="field-label">Self-Confidence Level: {confidence}%</label>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        className="slider-input confidence"
                        value={confidence}
                        onChange={(e) => setConfidence(Number(e.target.value))}
                      />
                      <div className="slider-limits">
                        <span>0% (No clue)</span>
                        <span>100% (Master)</span>
                      </div>
                    </div>

                    <button type="button" onClick={addSubject} className="btn btn-secondary">
                      + Add Subject to List
                    </button>
                  </div>

                  {/* Added Subjects List */}
                  <div className="added-subjects-section">
                    <h4>Subjects to Include ({subjectsList.length})</h4>

                    {subjectsList.length > 0 ? (
                      <div className="subjects-grid-list">
                        {subjectsList.map((sub, index) => (
                          <div key={index} className="subject-chip-card">
                            <div className="subject-chip-header">
                              <h5>{sub.name}</h5>
                              <button
                                type="button"
                                className="btn-delete-chip"
                                onClick={() => removeSubject(index)}
                              >
                                ×
                              </button>
                            </div>
                            <div className="subject-chip-details">
                              <span className="chip-badge priority capitalize">{sub.priority} Priority</span>
                              <span className="chip-badge">Confidence: {sub.confidence_level}%</span>
                              <span className="chip-badge">Credits: {sub.credits}</span>
                              {sub.exam_date && (
                                <span className="chip-badge exam-badge">
                                  Exam: {new Date(sub.exam_date).toLocaleDateString()}
                                </span>
                              )}
                            </div>
                            <div className="subject-chip-topics">
                              <strong>Topics:</strong> {sub.syllabus_topics.join(", ")}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="no-subjects-placeholder">
                        No subjects added yet. Configure above and click "Add Subject".
                      </div>
                    )}
                  </div>

                  {subjectsList.length > 0 && (
                    <button
                      onClick={generatePlan}
                      className="btn btn-primary btn-generate-plan"
                      disabled={loading}
                    >
                      Orchestrate Study Plan
                    </button>
                  )}
                </div>
              </div>
            )}

            {plan && (
              <div className="generated-plan-layout">
                <div className="plan-dashboard-header card">
                  <div className="dashboard-meta-left">
                    <span className="eyebrow">Personal Roadmap</span>
                    <h2>{plan._raw?.title || "Your Customized Study Plan"}</h2>
                    <p className="muted">
                      {plan._raw?.description || "A detailed schedule generated using multi-agent optimization."}
                    </p>
                  </div>
                  <div className="dashboard-meta-right">
                    {plan._raw?.confidence_score && (
                      <div className="meta-metric">
                        <span className="metric-val">{Math.round(plan._raw.confidence_score * 100)}%</span>
                        <span className="metric-label">AI Plan confidence</span>
                      </div>
                    )}
                    <button className="btn-ghost" onClick={resetPlanSettings}>
                      Configure New Plan
                    </button>
                  </div>
                </div>

                {/* Recommendations Row */}
                {plan.recommendations && plan.recommendations.length > 0 && (
                  <div className="recommendations-container card">
                    <h3>Recommendations & Strategy</h3>
                    <ul className="recommendations-list">
                      {plan.recommendations.map((rec, i) => (
                        <li key={i}>{rec}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Main Daily Schedules Visualizer */}
                {plan._raw?.daily_schedules ? (
                  <div className="daily-schedule-visualizer">
                    {/* Horizontal Day Tabs */}
                    <div className="day-tabs-slider">
                      {plan._raw.daily_schedules.map((schedule, idx) => {
                        const isActive = activeDayIndex === idx;
                        const dateStr = new Date(schedule.date).toLocaleDateString("en-GB", {
                          weekday: "short",
                          day: "numeric",
                          month: "short",
                        });

                        return (
                          <button
                            key={idx}
                            className={`day-tab-btn ${isActive ? "active" : ""}`}
                            onClick={() => setActiveDayIndex(idx)}
                          >
                            <span className="tab-date">{dateStr}</span>
                            <span className="tab-label">Day {idx + 1}</span>
                          </button>
                        );
                      })}
                    </div>

                    {/* Day Details panel */}
                    {plan._raw.daily_schedules[activeDayIndex] && (
                      <div className="day-detail-panel card">
                        <div className="day-panel-header">
                          <div className="header-goal-box">
                            <h4>Daily Goal</h4>
                            <p className="daily-goal-text">
                              {plan._raw.daily_schedules[activeDayIndex].daily_goal || "General study and coverage"}
                            </p>
                          </div>
                          <div className="header-duration-metric">
                            <span className="val">
                              {Math.round(
                                plan._raw.daily_schedules[activeDayIndex].total_study_minutes / 60
                              )}{" "}
                              hrs
                            </span>
                            <span className="label">Study Time</span>
                          </div>
                        </div>

                        {/* Timeline blocks */}
                        <div className="timeline-flow">
                          {plan._raw.daily_schedules[activeDayIndex].blocks.map((block, bIdx) => {
                            const isBreak = block.block_type === "break";

                            return (
                              <div
                                key={bIdx}
                                className={`timeline-block-card ${isBreak ? "break-block" : ""} type-${block.block_type}`}
                              >
                                <div className="block-time-col">
                                  <span className="time-range">
                                    {block.start_time} - {block.end_time}
                                  </span>
                                  <span className="duration-tag">{block.duration_minutes} min</span>
                                </div>

                                <div className="block-details-col">
                                  {!isBreak ? (
                                    <>
                                      <div className="block-meta-row">
                                        <span className={`block-badge type capitalize`}>
                                          {block.block_type}
                                        </span>
                                        {block.priority && (
                                          <span className={`block-badge priority capitalize`}>
                                            {block.priority} Priority
                                          </span>
                                        )}
                                      </div>
                                      <h4 className="block-title">
                                        {block.subject}: <span className="text-normal">{block.topic}</span>
                                      </h4>
                                      {block.notes && <p className="block-notes">{block.notes}</p>}
                                    </>
                                  ) : (
                                    <div className="break-contents">
                                      <span className="coffee-icon">☕</span>
                                      <span className="break-label">Relax / Break Window: {block.notes || "Refresh your mind"}</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  // Fallback to text lines (study_plan array)
                  <div className="plan-card text-fallback card">
                    <h2>Generated Study Roadmap</h2>
                    {plan.study_plan?.map((item, index) => (
                      <div key={index} className="plan-day">
                        <h4>{item.day}</h4>
                        <p>{item.task}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </Layout>
  );
};

export default Planner;