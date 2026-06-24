import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import Layout from "../components/Layout";
import LoadingSpinner from "../components/LoadingSpinner";
import API from "../services/api";
import "../styles/studyBuddy.css";

const StudyBuddy = () => {
  const [profile, setProfile] = useState({
    subjects: [],
    topicsNeeded: [],
    topicsStrong: [],
    availability: "",
    skillLevel: "Intermediate",
    isMatchingEnabled: false,
  });

  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedBuddy, setSelectedBuddy] = useState(null);
  const [sendingInvite, setSendingInvite] = useState(false);

  // Form states
  const [formSubjects, setFormSubjects] = useState("");
  const [formTopicsNeeded, setFormTopicsNeeded] = useState("");
  const [formTopicsStrong, setFormTopicsStrong] = useState("");
  const [formAvailability, setFormAvailability] = useState("");
  const [formSkillLevel, setFormSkillLevel] = useState("Intermediate");
  const [formMatchingEnabled, setFormMatchingEnabled] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const profileRes = await API.get("/study-buddy/profile");
      const userProfile = profileRes.data.data;
      if (userProfile) {
        setProfile(userProfile);
        setFormSubjects(userProfile.subjects.join(", "));
        setFormTopicsNeeded(userProfile.topicsNeeded.join(", "));
        setFormTopicsStrong(userProfile.topicsStrong.join(", "));
        setFormAvailability(userProfile.availability || "");
        setFormSkillLevel(userProfile.skillLevel || "Intermediate");
        setFormMatchingEnabled(userProfile.isMatchingEnabled || false);
      }

      const matchesRes = await API.get("/study-buddy/matches");
      setMatches(matchesRes.data.data || []);
    } catch (err) {
      console.error("[StudyBuddy] Load failed:", err.message);
      toast.error("Failed to load matching workspace");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      const res = await API.put("/study-buddy/profile", {
        subjects: formSubjects,
        topicsNeeded: formTopicsNeeded,
        topicsStrong: formTopicsStrong,
        availability: formAvailability,
        skillLevel: formSkillLevel,
        isMatchingEnabled: formMatchingEnabled,
      });

      setProfile(res.data.data);
      toast.success("Matching profile updated!");

      // Refresh matches list
      const matchesRes = await API.get("/study-buddy/matches");
      setMatches(matchesRes.data.data || []);
    } catch (err) {
      console.error("[StudyBuddy] Save failed:", err.message);
      toast.error(err.response?.data?.message || "Failed to save profile");
    } finally {
      setSaving(false);
    }
  };

  const handleSendInvitation = async (buddyId) => {
    try {
      setSendingInvite(true);
      const res = await API.post("/study-buddy/invite", { buddyId });
      toast.success(res.data.message || "Invitation email sent successfully!");
      setSelectedBuddy(null);
    } catch (err) {
      console.error("[StudyBuddy] Invitation failed:", err.message);
      toast.error(err.response?.data?.message || "Failed to send invitation email.");
    } finally {
      setSendingInvite(false);
    }
  };

  return (
    <Layout>
      <div className="buddy-shell">
        <section className="buddy-hero">
          <div>
            <span className="eyebrow">AI + Social Learning Platform</span>
            <h1>Study Buddy Matching</h1>
            <p className="hero-copy">
              Connect with fellow students who share subjects, match your availability, or have strengths in topics you struggle with.
            </p>
          </div>
        </section>

        {loading ? (
          <LoadingSpinner message="Locating compatible study partners..." />
        ) : (
          <div className="buddy-workspace">
            {/* Left Column: My Buddy Profile form */}
            <form className="buddy-profile-form card" onSubmit={handleSave}>
              <h2>My Study Profile</h2>
              <p className="muted" style={{ marginBottom: 20 }}>
                Set your topics and availability to compute match metrics.
              </p>

              <div className="field-grid">
                {/* Matchmaking Switch */}
                <div className="toggle-container" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--accent-soft)", padding: "12px 16px", borderRadius: "14px", border: "1px solid var(--border)" }}>
                  <div>
                    <label style={{ fontWeight: 700, color: "var(--accent-deep)" }}>Enable Matchmaking</label>
                    <p className="muted" style={{ fontSize: "0.8rem", marginTop: 2 }}>Allow others to match with you</p>
                  </div>
                  <input
                    type="checkbox"
                    className="toggle-checkbox"
                    checked={formMatchingEnabled}
                    onChange={(e) => setFormMatchingEnabled(e.target.checked)}
                    style={{ width: 22, height: 22, cursor: "pointer" }}
                  />
                </div>

                <div>
                  <label className="stat-label">Subjects I study</label>
                  <input
                    className="input"
                    placeholder="e.g. DSA, Mathematics, Chemistry"
                    value={formSubjects}
                    onChange={(e) => setFormSubjects(e.target.value)}
                  />
                </div>

                <div>
                  <label className="stat-label">Topics I need help with</label>
                  <input
                    className="input"
                    placeholder="e.g. Graphs, Integration, Organic reactions"
                    value={formTopicsNeeded}
                    onChange={(e) => setFormTopicsNeeded(e.target.value)}
                  />
                </div>

                <div>
                  <label className="stat-label">Topics I am strong in</label>
                  <input
                    className="input"
                    placeholder="e.g. Sorting, Probability, Periodic trends"
                    value={formTopicsStrong}
                    onChange={(e) => setFormTopicsStrong(e.target.value)}
                  />
                </div>

                <div>
                  <label className="stat-label">My Availability</label>
                  <input
                    className="input"
                    placeholder="e.g. 7PM-9PM, Weekends, Afternoons"
                    value={formAvailability}
                    onChange={(e) => setFormAvailability(e.target.value)}
                  />
                </div>

                <div>
                  <label className="stat-label">My Skill Level</label>
                  <select
                    className="select"
                    value={formSkillLevel}
                    onChange={(e) => setFormSkillLevel(e.target.value)}
                  >
                    <option value="Beginner">Beginner</option>
                    <option value="Intermediate">Intermediate</option>
                    <option value="Advanced">Advanced</option>
                  </select>
                </div>

                <button className="btn" type="submit" disabled={saving} style={{ marginTop: 10 }}>
                  {saving ? "Saving..." : "Save Matching Profile"}
                </button>
              </div>
            </form>

            {/* Right Column: Matches list */}
            <main className="buddy-matches-panel">
              <div className="matches-header">
                <h2>Your Study Matches</h2>
                <span className="badge" style={{ background: "var(--accent-soft)", color: "var(--accent-deep)" }}>
                  {matches.length} active matching candidates
                </span>
              </div>

              {!profile.isMatchingEnabled && (
                <div className="alert-card warning-alert" style={{ display: "flex", gap: 12, background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)", padding: 16, borderRadius: 16, marginBottom: 20 }}>
                  <span style={{ fontSize: "1.4rem" }}>⚠️</span>
                  <div>
                    <strong style={{ color: "#d97706" }}>Matchmaking is currently disabled in your profile.</strong>
                    <p className="muted" style={{ fontSize: "0.85rem", marginTop: 4 }}>
                      Toggle "Enable Matchmaking" on the left panel so other students can discover and match with you!
                    </p>
                  </div>
                </div>
              )}

              {matches.length === 0 ? (
                <div className="card empty-matches-card" style={{ textAlign: "center", padding: "48px 24px" }}>
                  <div style={{ fontSize: "3rem", marginBottom: 12 }}>🤝</div>
                  <h3>No Study Matches Found Yet</h3>
                  <p className="muted" style={{ maxWidth: 440, margin: "8px auto 0" }}>
                    There are no other users matching your criteria currently. Try adding more general subjects or wait for other students to register their study profiles!
                  </p>
                </div>
              ) : (
                <div className="matches-list">
                  {matches.map((buddy) => (
                    <div key={buddy._id} className="card buddy-card animate-fade">
                      <div className="buddy-card-top">
                        <div className="buddy-info">
                          <h3>{buddy.name}</h3>
                          <div className="buddy-details">
                            <span className="availability-tag">
                              🕒 {buddy.availability || "Not specified"}
                            </span>
                            <span className="skill-tag">
                              ⚡ {buddy.skillLevel}
                            </span>
                          </div>
                        </div>

                        {/* Match Score Gauge */}
                        <div className="match-score-gauge">
                          <div className="score-number">{buddy.matchScore}%</div>
                          <div className="score-label">compatibility</div>
                        </div>
                      </div>

                      {/* Subjects */}
                      {buddy.subjects && buddy.subjects.length > 0 && (
                        <div className="buddy-tags-row">
                          <span className="tag-label">Studies:</span>
                          <div className="tags-container">
                            {buddy.subjects.map((sub, i) => (
                              <span key={i} className="badge subject-badge">{sub}</span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Overlaps and Complementary indicators */}
                      <div className="compatibility-audit">
                        {buddy.sharedSubjects && buddy.sharedSubjects.length > 0 && (
                          <div className="audit-item positive">
                            <span className="audit-icon">✓</span>
                            <span>Shared Subjects: <strong>{buddy.sharedSubjects.join(", ")}</strong></span>
                          </div>
                        )}
                        {buddy.sharedStrong && buddy.sharedStrong.length > 0 && (
                          <div className="audit-item highlight">
                            <span className="audit-icon">🌟</span>
                            <span>Can teach you: <strong>{buddy.sharedStrong.join(", ")}</strong></span>
                          </div>
                        )}
                        {buddy.sharedWeak && buddy.sharedWeak.length > 0 && (
                          <div className="audit-item helper">
                            <span className="audit-icon">🤝</span>
                            <span>You can help them with: <strong>{buddy.sharedWeak.join(", ")}</strong></span>
                          </div>
                        )}
                      </div>

                      <div className="buddy-card-actions">
                        <button
                          className="btn-secondary"
                          onClick={() => setSelectedBuddy(buddy)}
                        >
                          Send Invitation / Connect
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </main>
          </div>
        )}

        {/* Connection Modal */}
        {selectedBuddy && (
          <div className="buddy-modal-overlay" onClick={() => setSelectedBuddy(null)}>
            <div className="buddy-modal card animate-scale" onClick={(e) => e.stopPropagation()}>
              <button className="modal-close-btn" onClick={() => setSelectedBuddy(null)}>×</button>
              <div className="modal-header-accent" />
              <div className="modal-body" style={{ padding: 24 }}>
                <span className="modal-avatar">👥</span>
                <h2>Connect with {selectedBuddy.name}</h2>
                <p className="muted" style={{ margin: "8px 0 20px" }}>
                  Form a study room, collaborate on DSA problems, or exchange quiz details!
                </p>

                <div className="modal-contact-box" style={{ background: "var(--panel-strong)", padding: 18, borderRadius: 14, border: "1px solid var(--border)", marginBottom: 20 }}>
                  <div className="stat-label">Email Address</div>
                  <div style={{ fontSize: "1.15rem", fontWeight: 700, color: "var(--accent-deep)", wordBreak: "break-all", marginTop: 4 }}>
                    {selectedBuddy.email}
                  </div>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <button
                    className="btn"
                    style={{ flex: 1, padding: "12px", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
                    onClick={() => handleSendInvitation(selectedBuddy._id)}
                    disabled={sendingInvite}
                  >
                    {sendingInvite ? "Sending Invitation..." : "✉️ Send Invitation Email"}
                  </button>
                  <div style={{ display: "flex", gap: 10 }}>
                    <a
                      href={`mailto:${selectedBuddy.email}?subject=StudyForge Buddy Connection!`}
                      className="btn-secondary"
                      style={{ flex: 1, textAlign: "center", textDecoration: "none", display: "flex", alignItems: "center", justifyContent: "center", padding: "10px", fontSize: "0.9rem" }}
                    >
                      Direct Mailto
                    </a>
                    <button
                      className="btn-secondary"
                      style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "10px", fontSize: "0.9rem" }}
                      onClick={() => {
                        navigator.clipboard.writeText(selectedBuddy.email);
                        toast.success("Email copied to clipboard!");
                      }}
                    >
                      Copy Email
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default StudyBuddy;
