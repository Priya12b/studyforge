import { useState, useEffect, useRef } from "react";
import toast from "react-hot-toast";

import Layout from "../components/Layout";
import API from "../services/api";
import "../styles/chatbot.css";

const Chatbot = () => {
  const [message, setMessage] = useState("");
  const [chat, setChat] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const recognitionRef = useRef(null);
  const pendingTranscriptRef = useRef("");
  const finalTranscriptRef = useRef("");
  const requestInFlightRef = useRef(false);

  // Stop reading AI voice responses if user leaves page
  useEffect(() => {
    return () => {
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const speakResponse = (text) => {
    if (!window.speechSynthesis) return;

    window.speechSynthesis.cancel();

    // Clean text by removing markdown tags for natural speech
    const cleanText = text
      .replace(/\*\*|__/g, "")
      .replace(/\*|_/g, "")
      .replace(/#+\s+/g, "")
      .replace(/`[^`]+`/g, (match) => match.replace(/`/g, ""))
      .replace(/```[^`]+```/g, "[Code snippet]");

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    window.speechSynthesis.speak(utterance);
  };

  const stopSpeaking = () => {
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.onend = null;
      recognitionRef.current.onresult = null;
      recognitionRef.current.onerror = null;
      recognitionRef.current.abort();
      recognitionRef.current = null;
    }

    setIsListening(false);
  };

  const queueTranscriptSend = (transcript) => {
    const cleanTranscript = transcript.trim();
    if (!cleanTranscript || requestInFlightRef.current) {
      return;
    }

    if (cleanTranscript === pendingTranscriptRef.current) {
      return;
    }

    pendingTranscriptRef.current = cleanTranscript;
    setMessage(cleanTranscript);
    sendMessageWithText(cleanTranscript);
  };

  const handleVoiceInput = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast.error("Speech recognition is not supported in this browser. Try Chrome or Edge.");
      return;
    }

    if (requestInFlightRef.current || loading) {
      return;
    }

    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);

    if (isListening) {
      stopListening();
      setIsListening(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;
    finalTranscriptRef.current = "";
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.continuous = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setIsListening(true);
      toast.success("Listening... Speak now");
    };

    recognition.onresult = (event) => {
      if (!speechToText || requestInFlightRef.current || loading) return;
      const latestResult = event.results[event.results.length - 1];
      const speechToText = latestResult?.[0]?.transcript?.trim() || "";

      if (!speechToText) {
        return;
      }

      finalTranscriptRef.current = speechToText;
      setMessage(speechToText);
    };

    recognition.onerror = (event) => {
      console.error("[Speech Recognition] Error:", event.error);
      setIsListening(false);
      recognitionRef.current = null;
      pendingTranscriptRef.current = "";
      toast.error("Speech recognition failed: " + event.error);
    };

    recognition.onend = () => {
      if (!speechToText || requestInFlightRef.current || loading) return;
      setIsListening(false);
      if (recognitionRef.current === recognition) {
        recognitionRef.current = null;
      }

      const transcript = finalTranscriptRef.current.trim();
      finalTranscriptRef.current = "";

      if (transcript) {
        queueTranscriptSend(transcript);
      }
    };

    recognition.start();
  };

  const sendMessageWithText = async (textToSend) => {
    const trimmedMessage = textToSend.trim();
    if (!trimmedMessage || requestInFlightRef.current) return;

    requestInFlightRef.current = true;
    setLoading(true);

    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
    stopListening();

    try {
      const res = await API.post("/chatbot", {
        message: trimmedMessage,
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
          user: trimmedMessage,
          ai: res.data.reply,
        },
      ]);

      setMessage("");

      if (res.data.reply) {
        speakResponse(res.data.reply);
      }
    } catch (error) {
      console.error("[Chatbot] Send failed:", error.message);
      toast.error("Failed to send message. Please try again.");
    } finally {
      requestInFlightRef.current = false;
      pendingTranscriptRef.current = "";
      setLoading(false);
    }
  };

  const sendMessage = () => {
    const trimmed = message.trim();
    if (!trimmed || requestInFlightRef.current) return;
    sendMessageWithText(trimmed);
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
          <h1>AI Chatbot & Voice Assistant</h1>
          <p className="muted">
            Ask for topic explanations, revision ideas, or quick study direction using text or voice.
          </p>
        </section>

        <section className="card chatbot-panel">
          <div className="chatbot-input-row">
            <input
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              className="input"
              placeholder="Type your study question or speak..."
              style={{ width: "100%" }}
            />

            <div style={{ display: "flex", gap: "8px" }}>
              {isSpeaking && (
                <button className="voice-btn speaking" onClick={stopSpeaking} title="Stop Al voice readback">
                  🔊 Mute
                </button>
              )}

              <button
                className={`voice-btn ${isListening ? "listening" : ""}`}
                onClick={handleVoiceInput}
                disabled={loading}
                title="Ask using Voice"
              >
                {isListening ? "🎙️ Listening..." : "🎙️ Mic"}
              </button>
            </div>

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
                  <p>
                    <strong>You:</strong> {entry.user}
                  </p>
                  <p>
                    <strong>AI:</strong> {entry.ai}
                  </p>
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
