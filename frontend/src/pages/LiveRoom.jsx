import { useEffect, useRef, useState, useContext } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { io } from "socket.io-client";
import toast from "react-hot-toast";
import Layout from "../components/Layout";
import { AuthContext } from "../context/AuthContext";

const SOCKET_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";

const LiveRoom = () => {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);

  const socketRef = useRef(null);
  const canvasRef = useRef(null);
  const chatEndRef = useRef(null);

  // Room State
  const [members, setMembers] = useState([]);
  const [hostId, setHostId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");

  // Timer State
  const [timer, setTimer] = useState({
    timeLeft: 25 * 60,
    duration: 25 * 60,
    isRunning: false,
    type: "work",
    workDuration: 25 * 60,
    breakDuration: 5 * 60,
  });

  const [showAdjustSettings, setShowAdjustSettings] = useState(false);
  const [customStudyInput, setCustomStudyInput] = useState(25);
  const [customBreakInput, setCustomBreakInput] = useState(5);

  // Sync inputs with the server settings
  useEffect(() => {
    if (timer.workDuration) {
      setCustomStudyInput(Math.round(timer.workDuration / 60));
    }
    if (timer.breakDuration) {
      setCustomBreakInput(Math.round(timer.breakDuration / 60));
    }
  }, [timer.workDuration, timer.breakDuration]);

  // Whiteboard Drawing State
  const [isDrawing, setIsDrawing] = useState(false);
  const [brushColor, setBrushColor] = useState("#7c3aed"); // default purple
  const [brushWidth, setBrushWidth] = useState(3);
  const prevPosRef = useRef({ x: 0, y: 0 });

  // Connect to socket on mount
  useEffect(() => {
    if (!user) {
      toast.error("Please login to join study rooms");
      navigate("/login");
      return;
    }

    // Initialize socket connection
    const socket = io(SOCKET_URL, {
      transports: ["websocket", "polling"],
      withCredentials: true,
    });
    socketRef.current = socket;

    // Extract optional custom study & break parameters from URL
    const searchParams = new URLSearchParams(window.location.search);
    const studyMins = searchParams.get("study") ? parseInt(searchParams.get("study")) : null;
    const breakMins = searchParams.get("break") ? parseInt(searchParams.get("break")) : null;

    // Join room
    socket.emit("join-room", {
      roomId,
      user: {
        id: user.id || user._id,
        name: user.name || "Student",
        avatar: user.avatar || "",
      },
      settings: studyMins || breakMins ? {
        study: studyMins,
        break: breakMins,
      } : null
    });

    // Event Listeners
    socket.on("room-update", ({ members, host, timer }) => {
      setMembers(members);
      setHostId(host);
      setTimer(timer);
    });

    socket.on("chat-message", (message) => {
      setMessages((prev) => [...prev, message]);
    });

    socket.on("timer-update", (updatedTimer) => {
      setTimer(updatedTimer);
    });

    socket.on("timer-complete", ({ type, message }) => {
      toast(message, {
        icon: type === "work" ? "🧠" : "☕",
        duration: 5000,
      });
      // Play a small default audio chime if possible
      try {
        const audio = new Audio("https://assets.mixkit.co/active_storage/sfx/2869/2869-500.wav");
        audio.play();
      } catch (e) {
        console.log("Audio chime failed to play:", e.message);
      }
    });

    socket.on("draw-line", ({ prevPos, currPos, color, width }) => {
      drawOnCanvas(prevPos, currPos, color, width);
    });

    socket.on("clear-canvas", () => {
      clearLocalCanvas();
    });

    // Cleanup
    return () => {
      socket.emit("leave-room");
      socket.disconnect();
    };
  }, [roomId, user]);

  // Scroll chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Is current client the host?
  const isHost = socketRef.current ? socketRef.current.id === hostId : false;

  // Send Message
  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    socketRef.current.emit("send-message", { message: chatInput.trim() });
    setChatInput("");
  };

  // Synced Timer Controls (Host only)
  const handleTimerAction = (action, duration = null, extraParams = {}) => {
    socketRef.current.emit("timer-control", {
      action,
      duration,
      type: timer.type,
      ...extraParams
    });
  };

  const handleSaveSettings = (e) => {
    e.preventDefault();
    handleTimerAction("update-settings", null, {
      workDuration: customStudyInput,
      breakDuration: customBreakInput,
    });
    setShowAdjustSettings(false);
    toast.success("Timer settings updated!");
  };

  // Format Timer Text
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  // Drawing helpers
  const drawOnCanvas = (prevPos, currPos, color, width) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    ctx.beginPath();
    ctx.moveTo(prevPos.x, prevPos.y);
    ctx.lineTo(currPos.x, currPos.y);
    ctx.stroke();
  };

  const getCoordinates = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    
    // Support touch and mouse
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;

    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
    };
  };

  const startDrawing = (e) => {
    const coords = getCoordinates(e);
    prevPosRef.current = coords;
    setIsDrawing(true);
  };

  const draw = (e) => {
    if (!isDrawing) return;
    e.preventDefault(); // Prevent scrolling on touch devices

    const coords = getCoordinates(e);
    const prevPos = prevPosRef.current;
    
    drawOnCanvas(prevPos, coords, brushColor, brushWidth);

    // Sync to other users
    socketRef.current.emit("draw-line", {
      prevPos,
      currPos: coords,
      color: brushColor,
      width: brushWidth,
    });

    prevPosRef.current = coords;
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearLocalCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const handleClearWhiteboard = () => {
    socketRef.current.emit("clear-canvas");
  };

  return (
    <Layout>
      <div className="dashboard-shell" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {/* Top bar details */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
          <div>
            <span className="eyebrow" style={{ marginRight: 10 }}>Room Code: {roomId}</span>
            <span className="eyebrow" style={{ background: "var(--border)", color: "var(--text)" }}>
              {members.length} {members.length === 1 ? "student" : "students"} online
            </span>
            <h1 style={{ marginTop: 6, fontSize: "2rem" }}>Active Study Space</h1>
          </div>
          <button className="btn-secondary" onClick={() => navigate("/rooms")}>
            Leave Room 🚪
          </button>
        </div>

        {/* Dashboard Grid */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: 20, minHeight: 620 }}>
          {/* Main workspace (Timer & Whiteboard) */}
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {/* Synced timer card */}
            <div className="card glass" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "24px 30px" }}>
              <div>
                <span className="eyebrow" style={{ background: timer.type === "work" ? "rgba(124,58,237,0.15)" : "rgba(16,185,129,0.15)", color: timer.type === "work" ? "var(--accent)" : "var(--success)" }}>
                  {timer.type === "work" ? "🧠 FOCUSING SESSION" : "☕ BREAK TIME"}
                </span>
                <div style={{ fontSize: "3rem", fontWeight: 800, fontFamily: "var(--heading)", color: "var(--text-strong)", margin: "8px 0" }}>
                  {formatTime(timer.timeLeft)}
                </div>
                <p className="muted" style={{ fontSize: "0.9rem" }}>
                  {timer.type === "work"
                    ? "Study quietly. Check off tasks, read and draft plans."
                    : "Grab a coffee, walk around, or stretch. You've earned it!"}
                </p>
              </div>

              {/* Host Timer Controls */}
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {isHost ? (
                  <>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        className="btn"
                        style={{ height: 38, minHeight: 38, padding: "0 14px", fontSize: "0.9rem" }}
                        onClick={() => handleTimerAction(timer.isRunning ? "pause" : "start")}
                      >
                        {timer.isRunning ? "Pause" : "Start"}
                      </button>
                      <button
                        className="btn-secondary"
                        style={{ height: 38, minHeight: 38, padding: "0 14px", fontSize: "0.9rem" }}
                        onClick={() => handleTimerAction("reset")}
                      >
                        Reset
                      </button>
                    </div>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button
                        className="btn-ghost"
                        style={{ flex: 1, padding: "4px 8px", fontSize: "0.75rem", minHeight: 28 }}
                        onClick={() => handleTimerAction("reset", Math.round((timer.workDuration || 1500) / 60))}
                      >
                        {Math.round((timer.workDuration || 1500) / 60)}m Work
                      </button>
                      <button
                        className="btn-ghost"
                        style={{ flex: 1, padding: "4px 8px", fontSize: "0.75rem", minHeight: 28 }}
                        onClick={() => handleTimerAction("reset", Math.round((timer.breakDuration || 300) / 60))}
                      >
                        {Math.round((timer.breakDuration || 300) / 60)}m Break
                      </button>
                      <button
                        className="btn-ghost"
                        style={{ padding: "4px 8px", fontSize: "0.75rem", minHeight: 28 }}
                        onClick={() => setShowAdjustSettings(!showAdjustSettings)}
                      >
                        ⚙️ Adjust
                      </button>
                    </div>

                    {showAdjustSettings && (
                      <form onSubmit={handleSaveSettings} style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 8, borderTop: "1px solid var(--border)", paddingTop: 10 }}>
                        <div style={{ display: "flex", gap: 8 }}>
                          <div style={{ flex: 1 }}>
                            <label className="stat-label" style={{ fontSize: "0.75rem", display: "block", marginBottom: 4 }}>Work (m)</label>
                            <input
                              type="number"
                              className="input"
                              min="1"
                              max="180"
                              value={customStudyInput}
                              onChange={(e) => setCustomStudyInput(parseInt(e.target.value) || 25)}
                              style={{ minHeight: 32, height: 32, padding: "0 8px", fontSize: "0.85rem" }}
                            />
                          </div>
                          <div style={{ flex: 1 }}>
                            <label className="stat-label" style={{ fontSize: "0.75rem", display: "block", marginBottom: 4 }}>Break (m)</label>
                            <input
                              type="number"
                              className="input"
                              min="1"
                              max="60"
                              value={customBreakInput}
                              onChange={(e) => setCustomBreakInput(parseInt(e.target.value) || 5)}
                              style={{ minHeight: 32, height: 32, padding: "0 8px", fontSize: "0.85rem" }}
                            />
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: 6 }}>
                          <button type="submit" className="btn" style={{ flex: 1, minHeight: 30, height: 30, fontSize: "0.8rem", padding: "0 10px" }}>
                            Apply
                          </button>
                          <button type="button" className="btn-secondary" onClick={() => setShowAdjustSettings(false)} style={{ flex: 1, minHeight: 30, height: 30, fontSize: "0.8rem", padding: "0 10px" }}>
                            Cancel
                          </button>
                        </div>
                      </form>
                    )}
                  </>
                ) : (
                  <span className="muted" style={{ fontSize: "0.85rem", fontStyle: "italic", border: "1px solid var(--border)", padding: "8px 12px", borderRadius: 10 }}>
                    Host is controlling the session
                  </span>
                )}
              </div>
            </div>

            {/* Whiteboard card */}
            <div className="card glass" style={{ flex: 1, display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h2>Collaborative Whiteboard</h2>
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  {/* Colors */}
                  <div style={{ display: "flex", gap: 6 }}>
                    {["#7c3aed", "#ef4444", "#10b981", "#06b6d4", "#f59e0b", "#0f172a"].map((color) => (
                      <button
                        key={color}
                        onClick={() => setBrushColor(color)}
                        style={{
                          width: 20,
                          height: 20,
                          borderRadius: "50%",
                          backgroundColor: color,
                          border: brushColor === color ? "2px solid var(--text-strong)" : "1px solid var(--border)",
                          transform: brushColor === color ? "scale(1.15)" : "none",
                        }}
                      />
                    ))}
                  </div>

                  {/* Brush width */}
                  <select
                    className="select"
                    value={brushWidth}
                    onChange={(e) => setBrushWidth(parseInt(e.target.value))}
                    style={{ minHeight: 32, padding: "0 8px", width: 70, fontSize: "0.85rem" }}
                  >
                    <option value={2}>Thin</option>
                    <option value={4}>Medium</option>
                    <option value={8}>Thick</option>
                    <option value={15}>Bold</option>
                  </select>

                  <button
                    className="btn-secondary"
                    onClick={handleClearWhiteboard}
                    style={{ minHeight: 32, padding: "0 10px", fontSize: "0.85rem" }}
                  >
                    Clear Canvas
                  </button>
                </div>
              </div>

              {/* Drawing Area */}
              <div style={{ flex: 1, position: "relative", background: "var(--panel-solid)", border: "1px solid var(--border)", borderRadius: "var(--radius-md)", overflow: "hidden", minHeight: 300 }}>
                <canvas
                  ref={canvasRef}
                  width={640}
                  height={340}
                  onMouseDown={startDrawing}
                  onMouseMove={draw}
                  onMouseUp={stopDrawing}
                  onMouseLeave={stopDrawing}
                  onTouchStart={startDrawing}
                  onTouchMove={draw}
                  onTouchEnd={stopDrawing}
                  style={{
                    width: "100%",
                    height: "100%",
                    display: "block",
                    cursor: "crosshair",
                  }}
                />
              </div>
            </div>
          </div>

          {/* Right workspace (Participants & Chat) */}
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {/* Participants list */}
            <div className="card glass" style={{ display: "flex", flexDirection: "column", gap: 12, maxHeight: 200, overflowY: "auto" }}>
              <h2 style={{ fontSize: "1.1rem" }}>Online Users</h2>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {members.map((member) => (
                  <div key={member.socketId} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: "0.95rem", fontWeight: 500, color: "var(--text-strong)" }}>
                      👤 {member.name}
                    </span>
                    {member.socketId === hostId && (
                      <span className="eyebrow" style={{ fontSize: "0.65rem", padding: "1px 6px", background: "rgba(245,158,11,0.15)", color: "#d97706" }}>
                        Host
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Chat room */}
            <div className="card glass" style={{ flex: 1, display: "flex", flexDirection: "column", gap: 12, overflow: "hidden" }}>
              <h2 style={{ fontSize: "1.1rem" }}>Room Chat</h2>
              {/* Chat Thread */}
              <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8, paddingRight: 4, minHeight: 200 }}>
                {messages.length === 0 ? (
                  <p className="muted" style={{ textAlign: "center", fontSize: "0.85rem", marginTop: 20 }}>
                    No messages yet. Say hello!
                  </p>
                ) : (
                  messages.map((msg) => (
                    <div
                      key={msg.id}
                      style={{
                        padding: msg.isSystem ? "4px 8px" : "8px 12px",
                        borderRadius: "var(--radius-sm)",
                        background: msg.isSystem ? "var(--accent-soft)" : "var(--panel-solid)",
                        border: "1px solid var(--border)",
                        fontSize: "0.85rem",
                        textAlign: msg.isSystem ? "center" : "left",
                        alignSelf: msg.isSystem ? "center" : msg.senderId === user.id || msg.senderId === user._id ? "flex-end" : "flex-start",
                        maxWidth: msg.isSystem ? "90%" : "85%",
                      }}
                    >
                      {!msg.isSystem && (
                        <div style={{ fontWeight: 700, fontSize: "0.75rem", marginBottom: 2, color: "var(--accent-deep)" }}>
                          {msg.senderName}
                        </div>
                      )}
                      <p style={{ margin: 0, color: "var(--text-strong)" }}>{msg.message}</p>
                    </div>
                  ))
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Chat Send Form */}
              <form onSubmit={handleSendMessage} style={{ display: "flex", gap: 8 }}>
                <input
                  type="text"
                  className="input"
                  placeholder="Send chat..."
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  style={{ minHeight: 40, height: 40 }}
                />
                <button type="submit" className="btn" style={{ minHeight: 40, height: 40, padding: "0 12px" }}>
                  Send
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default LiveRoom;
