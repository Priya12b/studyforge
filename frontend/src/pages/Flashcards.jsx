import { useState } from "react";
import toast from "react-hot-toast";

import Layout from "../components/Layout";
import LoadingSpinner from "../components/LoadingSpinner";
import API from "../services/api";
import "../styles/flashcards.css";

const Flashcards = () => {
  const [formData, setFormData] = useState({
    subject: "",
    topic: "",
    num_cards: 10,
  });
  const [flashcards, setFlashcards] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [flippedCards, setFlippedCards] = useState({});

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleGenerate = async (e) => {
    e.preventDefault();
    if (!formData.subject.trim()) {
      toast.error("Subject is required");
      return;
    }

    setLoading(true);
    setError(null);
    setFlashcards([]);
    setFlippedCards({});

    try {
      const res = await API.post("/flashcards/generate", {
        subject: formData.subject,
        topic: formData.topic,
        num_cards: formData.num_cards,
      });

      if (res.data && res.data.flashcards) {
        setFlashcards(res.data.flashcards);
        toast.success(`Generated ${res.data.flashcards.length} flashcards!`);
      } else {
        throw new Error("Invalid response format");
      }
    } catch (err) {
      console.error("[Flashcards] Generation failed:", err.message);
      setError("Failed to generate flashcards. Please try again.");
      toast.error("Could not generate flashcards");
    } finally {
      setLoading(false);
    }
  };

  const toggleFlip = (index) => {
    setFlippedCards((prev) => ({
      ...prev,
      [index]: !prev[index],
    }));
  };

  return (
    <Layout>
      <div className="flashcards-container">
        <section>
          <span className="eyebrow">Smart Revision Tools</span>
          <h1>Flashcards</h1>
          <p className="muted">
            Create AI-powered active recall cards to master your subjects and topics.
          </p>
        </section>

        <form onSubmit={handleGenerate} className="flashcard-form surface page-card card">
          <div className="grid" style={{ gap: 16 }}>
            <div>
              <label className="stat-label">Subject</label>
              <input
                type="text"
                name="subject"
                placeholder="e.g. Physics, Chemistry, Economics"
                className="input"
                value={formData.subject}
                onChange={handleChange}
                required
                style={{ width: "100%", marginTop: 4 }}
              />
            </div>

            <div>
              <label className="stat-label">Topic (Optional)</label>
              <input
                type="text"
                name="topic"
                placeholder="e.g. Thermodynamics, Photosynthesis"
                className="input"
                value={formData.topic}
                onChange={handleChange}
                style={{ width: "100%", marginTop: 4 }}
              />
            </div>

            <div>
              <label className="stat-label">Number of Flashcards: {formData.num_cards}</label>
              <input
                type="range"
                name="num_cards"
                min="5"
                max="30"
                step="5"
                className="input"
                value={formData.num_cards}
                onChange={handleChange}
                style={{ width: "100%", marginTop: 8, padding: 0 }}
              />
            </div>
          </div>

          <button type="submit" className="btn" disabled={loading} style={{ marginTop: 10 }}>
            {loading ? "Generating..." : "Generate Flashcards"}
          </button>
        </form>

        {loading && <LoadingSpinner message="AI is reading topics and creating your flashcards..." />}

        {error && (
          <div className="error-card card">
            <p>{error}</p>
            <button className="btn-secondary" onClick={handleGenerate}>Retry</button>
          </div>
        )}

        {flashcards.length > 0 && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <h2>Your Flashcards ({flashcards.length})</h2>
              <p className="muted">Click cards to flip</p>
            </div>
            <div className="flashcards-grid">
              {flashcards.map((card, index) => (
                <div
                  key={index}
                  className={`flashcard ${flippedCards[index] ? "flipped" : ""}`}
                  onClick={() => toggleFlip(index)}
                >
                  <div className="flashcard-inner">
                    <div className="flashcard-front">
                      <span className="eyebrow" style={{ fontSize: "0.75rem", marginBottom: 8 }}>Front</span>
                      <h3>{card.front}</h3>
                      <span className="flashcard-hint">Click to see answer</span>
                    </div>
                    <div className="flashcard-back">
                      <span className="eyebrow" style={{ fontSize: "0.75rem", marginBottom: 8, color: "var(--accent-deep)" }}>Back</span>
                      <p style={{ fontWeight: 600 }}>{card.back}</p>
                      <span className="flashcard-hint" style={{ color: "var(--accent-deep)" }}>Click to flip back</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {!loading && flashcards.length === 0 && !error && (
          <div style={{ padding: 40, textAlign: "center" }} className="muted">
            No flashcards generated yet. Fill in the details above to start learning.
          </div>
        )}
      </div>
    </Layout>
  );
};

export default Flashcards;
