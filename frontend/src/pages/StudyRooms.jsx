import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "../components/Layout";
import "../styles/dashboard.css"; // Reuse dashboard styles for spacing and layouts

const StudyRooms = () => {
  const [roomId, setRoomId] = useState("");
  const [studyTime, setStudyTime] = useState(25);
  const [breakTime, setBreakTime] = useState(5);
  const [showCustomSettings, setShowCustomSettings] = useState(false);
  const navigate = useNavigate();

  // Create a randomized room ID and navigate to it
  const handleCreateRoom = () => {
    const randomId = Math.random().toString(36).substring(2, 8).toUpperCase();
    navigate(`/rooms/${randomId}?study=${studyTime}&break=${breakTime}`);
  };

  // Join existing room
  const handleJoinRoom = (e) => {
    e.preventDefault();
    if (roomId.trim()) {
      navigate(`/rooms/${roomId.trim().toUpperCase()}`);
    }
  };

  // Quick join presets
  const handleQuickJoin = (presetId) => {
    navigate(`/rooms/${presetId}`);
  };

  return (
    <Layout>
      <div className="dashboard-shell" style={{ maxWidth: 900, margin: "0 auto" }}>
        <div>
          <span className="eyebrow">Collaboration</span>
          <h1>Live Study Rooms</h1>
          <p className="muted">
            Study synchronously with your peers. Host study rooms, chat in real-time,
            sync Pomodoro timers, and draw on a shared whiteboard.
          </p>
        </div>

        <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 24, marginTop: 24 }}>
          
          {/* Create or Join Room Card */}
          <section className="card glass" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <h2>Enter a Room</h2>
            <p className="muted" style={{ fontSize: "0.95rem" }}>
              Join a room using an access code shared by your peers, or create a brand new room instantly.
            </p>
            
            <form onSubmit={handleJoinRoom} style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 8 }}>
              <div>
                <label className="stat-label" style={{ display: "block", marginBottom: 6 }}>Room Code</label>
                <input
                  type="text"
                  className="input"
                  placeholder="e.g. STUDY7"
                  value={roomId}
                  onChange={(e) => setRoomId(e.target.value)}
                  style={{ textTransform: "uppercase" }}
                  required
                />
              </div>
              <button type="submit" className="btn" style={{ width: "100%" }}>
                Join Room
              </button>
            </form>

            <div style={{ display: "flex", alignItems: "center", margin: "8px 0" }}>
              <div style={{ flex: 1, height: 1, backgroundColor: "var(--border)" }}></div>
              <span className="muted" style={{ margin: "0 12px", fontSize: "0.85rem" }}>OR</span>
              <div style={{ flex: 1, height: 1, backgroundColor: "var(--border)" }}></div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <button 
                onClick={() => setShowCustomSettings(!showCustomSettings)} 
                className="btn-secondary" 
                style={{ width: "100%", justifyContent: "space-between" }}
              >
                <span>Create Custom Room ⚙️</span>
                <span>{showCustomSettings ? "▲" : "▼"}</span>
              </button>

              {showCustomSettings && (
                <div style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 12,
                  padding: "16px",
                  background: "rgba(255, 255, 255, 0.03)",
                  borderRadius: "var(--radius-md)",
                  border: "1px solid var(--border)"
                }}>
                  <div style={{ display: "flex", gap: 12 }}>
                    <div style={{ flex: 1 }}>
                      <label className="stat-label" style={{ display: "block", marginBottom: 6, fontSize: "0.85rem" }}>Study (mins)</label>
                      <input
                        type="number"
                        className="input"
                        min="1"
                        max="180"
                        value={studyTime}
                        onChange={(e) => setStudyTime(parseInt(e.target.value) || 25)}
                        style={{ minHeight: 40, height: 40 }}
                      />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label className="stat-label" style={{ display: "block", marginBottom: 6, fontSize: "0.85rem" }}>Break (mins)</label>
                      <input
                        type="number"
                        className="input"
                        min="1"
                        max="60"
                        value={breakTime}
                        onChange={(e) => setBreakTime(parseInt(e.target.value) || 5)}
                        style={{ minHeight: 40, height: 40 }}
                      />
                    </div>
                  </div>
                  <button onClick={handleCreateRoom} className="btn" style={{ width: "100%", minHeight: 40, height: 40 }}>
                    Launch Room 🚀
                  </button>
                </div>
              )}

              {!showCustomSettings && (
                <button onClick={handleCreateRoom} className="btn-secondary" style={{ width: "100%" }}>
                  Create Instant Room (25m/5m) 🚀
                </button>
              )}
            </div>
          </section>

          {/* Quick Rooms Card */}
          <section className="card glass" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <h2>Public Study Spaces</h2>
            <p className="muted" style={{ fontSize: "0.95rem" }}>
              Jump straight into any of our open interest-based rooms to find study partners.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 8 }}>
              <article 
                className="stat" 
                onClick={() => handleQuickJoin("MATH101")}
                style={{ cursor: "pointer", padding: "14px 18px", transition: "transform 150ms ease" }}
              >
                <div style={{ display: "flex", justifyContent: "between", alignItems: "center", width: "100%" }}>
                  <div style={{ textAlign: "left", flex: 1 }}>
                    <h3 style={{ fontSize: "1.1rem" }}>📐 Math & Physics</h3>
                    <p className="muted" style={{ fontSize: "0.85rem" }}>Calculus, equations & mechanics</p>
                  </div>
                  <span className="eyebrow" style={{ fontSize: "0.75rem", padding: "2px 8px" }}>Join</span>
                </div>
              </article>

              <article 
                className="stat" 
                onClick={() => handleQuickJoin("CODERUN")}
                style={{ cursor: "pointer", padding: "14px 18px", transition: "transform 150ms ease" }}
              >
                <div style={{ display: "flex", justifyContent: "between", alignItems: "center", width: "100%" }}>
                  <div style={{ textAlign: "left", flex: 1 }}>
                    <h3 style={{ fontSize: "1.1rem" }}>💻 Computer Science</h3>
                    <p className="muted" style={{ fontSize: "0.85rem" }}>Algorithms, React & Python debugging</p>
                  </div>
                  <span className="eyebrow" style={{ fontSize: "0.75rem", padding: "2px 8px" }}>Join</span>
                </div>
              </article>

              <article 
                className="stat" 
                onClick={() => handleQuickJoin("SILENT")}
                style={{ cursor: "pointer", padding: "14px 18px", transition: "transform 150ms ease" }}
              >
                <div style={{ display: "flex", justifyContent: "between", alignItems: "center", width: "100%" }}>
                  <div style={{ textAlign: "left", flex: 1 }}>
                    <h3 style={{ fontSize: "1.1rem" }}>🤫 Silent Library</h3>
                    <p className="muted" style={{ fontSize: "0.85rem" }}>Deep focus, Pomodoro & notes sharing</p>
                  </div>
                  <span className="eyebrow" style={{ fontSize: "0.75rem", padding: "2px 8px" }}>Join</span>
                </div>
              </article>
            </div>
          </section>

        </div>
      </div>
    </Layout>
  );
};

export default StudyRooms;
