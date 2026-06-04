import { useState } from "react";
import toast from "react-hot-toast";

import Layout from "../components/Layout";
import API from "../services/api";
import "../styles/chatbot.css";

const Chatbot = () => {
  const [message, setMessage] = useState("");
  const [chat, setChat] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState(null);

  const sendMessage = async () => {
    if (!message.trim()) {
      return;
    }

    setLoading(true);

    try {
      const res = await API.post("/chatbot", {
        message,
        provider: localStorage.getItem("activeProvider") || "gemini",
        model: localStorage.getItem("activeModel") || "google/gemini-2.5-flash",
        session_id: sessionId,
      });

      if (res.data.session_id) {
        setSessionId(res.data.session_id);
      }

      setChat((currentChat) => [
        ...currentChat,
        {
          user: message,
          ai: res.data.reply,
        },
      ]);

      setMessage("");
    } catch (error) {
      console.error("[Chatbot] Send failed:", error.message);
      toast.error("Failed to send message. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !loading) {
      sendMessage();
    }
  };

  return (
    <Layout>
      <div className="chatbot-shell">
        <section className="chatbot-hero card">
          <span className="eyebrow">Study Chat</span>
          <h1>AI Chatbot</h1>
          <p className="muted">
            Ask for topic explanations, revision ideas and quick study direction.
          </p>
        </section>

        <section className="card chatbot-panel">
          <div className="chatbot-input-row">
            <input
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              className="input"
              placeholder="Type your study question..."
            />

            <button onClick={sendMessage} className="btn" disabled={loading}>
              {loading ? "Sending..." : "Send"}
            </button>
          </div>

          <div className="chatbot-thread">
            {chat.length === 0 ? (
              <p className="muted">Start a conversation to see replies here.</p>
            ) : (
              chat.map((entry, index) => (
                <article className="chat-card" key={`${entry.user}-${index}`}>
                  <p><strong>You:</strong> {entry.user}</p>
                  <p><strong>AI:</strong> {entry.ai}</p>
                </article>
              ))
            )}
          </div>
        </section>
      </div>
    </Layout>
  );
};

export default Chatbot;