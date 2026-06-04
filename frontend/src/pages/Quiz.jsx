import { useState, useEffect } from "react";
import toast from "react-hot-toast";

import Layout from "../components/Layout";
import LoadingSpinner from "../components/LoadingSpinner";
import API from "../services/api";

import "../styles/quiz.css";

const Quiz = () => {
  const [subject, setSubject] = useState("");
  const [topic, setTopic] = useState("");
  const [numQuestions, setNumQuestions] = useState(5);
  const [difficulty, setDifficulty] = useState("mixed");
  
  // Notes integration state
  const [useNotes, setUseNotes] = useState(false);
  const [notes, setNotes] = useState([]);
  const [selectedNoteId, setSelectedNoteId] = useState("");
  const [notesLoading, setNotesLoading] = useState(false);

  const [quiz, setQuiz] = useState(null);
  const [answers, setAnswers] = useState([]);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  // Quiz History
  const [quizHistory, setQuizHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  
  // Expanded explanation states
  const [expandedExplanations, setExpandedExplanations] = useState({});

  const fetchHistory = async () => {
    try {
      setLoadingHistory(true);
      const res = await API.get("/quiz/history");
      if (res.data.success) {
        setQuizHistory(res.data.data);
      }
    } catch (error) {
      console.error("Failed to load quiz history", error);
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  useEffect(() => {
    if (useNotes) {
      const fetchNotes = async () => {
        setNotesLoading(true);
        try {
          const res = await API.get("/upload/notes");
          const fetchedNotes = res.data.notes || res.data.data || [];
          setNotes(fetchedNotes);
          if (fetchedNotes.length > 0) {
            setSelectedNoteId(fetchedNotes[0]._id);
          }
        } catch (error) {
          console.error("Failed to load notes", error);
          toast.error("Failed to load uploaded notes.");
        } finally {
          setNotesLoading(false);
        }
      };
      fetchNotes();
    }
  }, [useNotes]);

  const generateQuiz = async () => {
    if (!useNotes && (!subject.trim() || !topic.trim())) {
      toast.error("Please enter both subject and topic");
      return;
    }
    if (useNotes && !selectedNoteId) {
      toast.error("Please select a notes document first");
      return;
    }

    setLoading(true);
    setResult(null);
    setQuiz(null);
    setAnswers([]);
    setExpandedExplanations({});

    try {
      const payload = {
        subject: useNotes ? "Notes Quiz" : subject,
        topic: useNotes ? "Contextual Quiz" : topic,
        num_questions: Number(numQuestions),
        difficulty,
        use_notes: useNotes,
        document_ids: useNotes ? [selectedNoteId] : [],
        provider: localStorage.getItem("activeProvider") || "gemini",
        model: localStorage.getItem("activeModel") || "google/gemini-2.5-flash",
      };

      const res = await API.post("/quiz/generate", payload);
      setQuiz(res.data);
      toast.success("Quiz generated successfully!");
      fetchHistory();
    } catch (error) {
      console.log(error);
      toast.error(error.response?.data?.message || "Quiz generation failed");
    } finally {
      setLoading(false);
    }
  };

  const handleAnswer = (index, value) => {
    const updated = [...answers];
    updated[index] = value;
    setAnswers(updated);
  };

  const submitQuiz = async () => {
    if (!quiz?._id) {
      toast.error("Generate a quiz first");
      return;
    }

    // Check if all questions are answered
    if (answers.length < quiz.questions.length || answers.includes(undefined)) {
      if (!confirm("You have unanswered questions. Do you want to submit anyway?")) {
        return;
      }
    }

    setSubmitting(true);
    try {
      const res = await API.post(`/quiz/submit/${quiz._id}`, {
        answers,
      });
      setResult(res.data);
      toast.success("Quiz submitted successfully!");
      fetchHistory();
    } catch (error) {
      console.log(error);
      toast.error("Could not submit quiz");
    } finally {
      setSubmitting(false);
    }
  };

  const deleteQuiz = async (id, e) => {
    e.stopPropagation();
    if (!window.confirm("Are you sure you want to delete this quiz result?")) {
      return;
    }
    try {
      await API.delete(`/quiz/${id}`);
      toast.success("Quiz deleted");
      fetchHistory();
      if (result?.quiz?._id === id) {
        setResult(null);
      }
    } catch (error) {
      console.error("Delete failed:", error);
      toast.error("Failed to delete quiz");
    }
  };

  const viewQuizResult = (pastQuiz) => {
    // Construct simulated result object matching submitQuiz response
    setResult({
      score: pastQuiz.score ?? 0,
      weakTopics: pastQuiz.weakTopics ?? [],
      quiz: pastQuiz,
    });
    setQuiz(pastQuiz);
  };

  const toggleExplanation = (index) => {
    setExpandedExplanations((prev) => ({
      ...prev,
      [index]: !prev[index],
    }));
  };

  const resetQuiz = () => {
    setQuiz(null);
    setResult(null);
    setAnswers([]);
    setExpandedExplanations({});
  };

  return (
    <Layout>
      <div className="quiz-container">
        <section className="quiz-hero-section">
          <div>
            <span className="eyebrow">AI Quiz Studio</span>
            <h1>Adaptive Quiz Generator</h1>
            <p className="muted">Create custom topic-wise quizzes or test understanding from your uploaded study notes.</p>
          </div>
        </section>

        {!quiz && !result && (
          <div className="grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: 24 }}>
            <div className="quiz-setup-panel surface page-card">
              <h2>Quiz Settings</h2>
              
              <div className="settings-grid">
                {/* Note Toggle */}
                <div className="setting-toggle-row">
                  <label className="toggle-switch">
                    <input
                      type="checkbox"
                      checked={useNotes}
                      onChange={(e) => setUseNotes(e.target.checked)}
                    />
                    <span className="slider round"></span>
                  </label>
                  <div className="toggle-details">
                    <span className="toggle-title">Generate from Uploaded Notes</span>
                    <span className="muted text-sm">Select PDF notes to generate contextually grounded questions</span>
                  </div>
                </div>

                {/* Conditional inputs */}
                {useNotes ? (
                  <div className="field-group">
                    <label className="field-label">Select Notes Document</label>
                    {notesLoading ? (
                      <div className="loading-notes">Loading documents...</div>
                    ) : notes.length > 0 ? (
                      <select
                        className="select"
                        value={selectedNoteId}
                        onChange={(e) => setSelectedNoteId(e.target.value)}
                      >
                        {notes.map((note) => (
                          <option key={note._id} value={note._id}>
                            {note.title} ({new Date(note.createdAt).toLocaleDateString()})
                          </option>
                        ))}
                      </select>
                    ) : (
                      <div className="no-notes-alert">
                        No notes found. Please upload some PDFs in the <strong>Notes Upload</strong> section first.
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="fields-row">
                    <div className="field-group">
                      <label className="field-label">Subject</label>
                      <input
                        className="input"
                        type="text"
                        placeholder="e.g., Mathematics, Computer Science"
                        value={subject}
                        onChange={(e) => setSubject(e.target.value)}
                      />
                    </div>
                    <div className="field-group">
                      <label className="field-label">Topic</label>
                      <input
                        className="input"
                        type="text"
                        placeholder="e.g., Calculus, Linear Regression"
                        value={topic}
                        onChange={(e) => setTopic(e.target.value)}
                      />
                    </div>
                  </div>
                )}

                {/* Custom Parameters */}
                <div className="fields-row">
                  <div className="field-group">
                    <label className="field-label">Number of Questions</label>
                    <select
                      className="select"
                      value={numQuestions}
                      onChange={(e) => setNumQuestions(Number(e.target.value))}
                    >
                      <option value={3}>3 Questions</option>
                      <option value={5}>5 Questions</option>
                      <option value={10}>10 Questions</option>
                      <option value={15}>15 Questions</option>
                      <option value={20}>20 Questions</option>
                    </select>
                  </div>

                  <div className="field-group">
                    <label className="field-label">Difficulty Level</label>
                    <select
                      className="select"
                      value={difficulty}
                      onChange={(e) => setDifficulty(e.target.value)}
                    >
                      <option value="mixed">Mixed Difficulty</option>
                      <option value="easy">Easy</option>
                      <option value="medium">Medium</option>
                      <option value="hard">Hard</option>
                    </select>
                  </div>
                </div>
              </div>

              <button
                onClick={generateQuiz}
                className="btn btn-generate"
                disabled={loading || (useNotes && notes.length === 0)}
              >
                Generate Quiz
              </button>
            </div>

            {/* Quiz History List */}
            <div className="card">
              <h2>Recent Assessments</h2>
              {loadingHistory ? (
                <div style={{ padding: 20 }}>Loading history...</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 12 }}>
                  {quizHistory.length === 0 ? (
                    <p className="muted">No assessments taken yet.</p>
                  ) : (
                    quizHistory.map((pastQuiz) => (
                      <div key={pastQuiz._id} className="card" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap" }}>
                        <div>
                          <strong style={{ display: "block" }}>{pastQuiz.subject} - {pastQuiz.topic}</strong>
                          <span className="muted" style={{ fontSize: "0.8rem" }}>
                            Score: {pastQuiz.score ?? 0}/{pastQuiz.questions?.length ?? 5} • {new Date(pastQuiz.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                        <div style={{ display: "flex", gap: 6 }}>
                          <button className="btn btn-secondary btn-sm" onClick={() => viewQuizResult(pastQuiz)}>
                            Review
                          </button>
                          <button className="btn btn-ghost btn-sm" style={{ color: "var(--danger)" }} onClick={(e) => deleteQuiz(pastQuiz._id, e)}>
                            Delete
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {loading && (
          <div className="quiz-loading-state surface">
            <div className="loading-orbit">
              <div className="orbit-core">AI</div>
              <div className="orbit-ring"></div>
            </div>
            <h3>Formulating Questions...</h3>
            <p className="muted">Our AI agents are analyzing your content and drafting conceptual quiz questions.</p>
          </div>
        )}

        {quiz && !result && (
          <div className="quiz-card-container">
            <div className="quiz-card-header card">
              <div className="quiz-header-meta">
                <h2>{useNotes ? "Quiz from uploaded notes" : `${quiz.subject || subject}: ${quiz.topic || topic}`}</h2>
                <div className="quiz-meta-badges">
                  <span className="badge">Questions: {quiz.questions?.length}</span>
                  <span className="badge capitalize">Difficulty: {difficulty}</span>
                </div>
              </div>
              <button className="btn-ghost" onClick={resetQuiz}>Cancel Quiz</button>
            </div>

            <div className="quiz-questions-list">
              {quiz.questions.map((q, index) => (
                <div key={index} className="question-card">
                  <div className="question-number">Question {index + 1}</div>
                  <h3 className="question-text">{q.question}</h3>

                  <div className="options-grid">
                    {q.options.map((option, i) => {
                      const isSelected = answers[index] === option;
                      return (
                        <label
                          key={i}
                          className={`option-row-card ${isSelected ? "selected" : ""}`}
                        >
                          <input
                            type="radio"
                            name={`question-${index}`}
                            value={option}
                            checked={isSelected}
                            onChange={(e) => handleAnswer(index, e.target.value)}
                          />
                          <span className="option-letter">{String.fromCharCode(65 + i)}</span>
                          <span className="option-text">{option}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            <div className="quiz-action-footer">
              <button
                onClick={submitQuiz}
                className="btn btn-submit-quiz"
                disabled={submitting}
              >
                {submitting ? "Submitting Answers..." : "Submit Quiz Result"}
              </button>
            </div>
          </div>
        )}

        {result && (
          <div className="result-container">
            {/* Score Summary Panel */}
            <div className="result-header-panel card">
              <div className="score-summary-left">
                <span className="eyebrow">Assessment Complete</span>
                <h2>Performance Summary</h2>
                <p className="muted">Check detailed reviews below to learn from mistakes and view correct explanations.</p>
              </div>
              <div className="score-badge-circle">
                <div className="score-value">{result.score}</div>
                <div className="score-total">/ {result.quiz?.questions?.length || quiz?.questions?.length || 5}</div>
                <div className="score-percentage">
                  {Math.round((result.score / (result.quiz?.questions?.length || quiz?.questions?.length || 5)) * 100)}%
                </div>
              </div>
            </div>

            {result.weakTopics && result.weakTopics.length > 0 && (
              <div className="weak-topics-panel card">
                <h3>Weak Topics Flagged</h3>
                <p className="muted text-sm">We recommend revising the following concepts further based on quiz answers:</p>
                <div className="weak-topics-list">
                  {result.weakTopics.map((topic, index) => (
                    <span key={index} className="weak-topic-tag">{topic}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Detailed Review Section */}
            <div className="detailed-review-section">
              <h2>Detailed Question Review</h2>
              
              <div className="quiz-questions-list review-mode">
                {(result.quiz?.questions || quiz?.questions || []).map((q, index) => {
                  const userAnswer = result.quiz ? q.userAnswer : answers[index];
                  const correctAnswer = q.correctAnswer;
                  const isCorrect = userAnswer === correctAnswer;
                  const showExplanation = expandedExplanations[index];

                  return (
                    <div key={index} className={`question-card review-card ${isCorrect ? "correct-border" : "incorrect-border"}`}>
                      <div className="review-question-header">
                        <span className={`question-status-badge ${isCorrect ? "correct" : "incorrect"}`}>
                          {isCorrect ? "✓ Correct" : "✗ Incorrect"}
                        </span>
                        {q.difficulty && (
                          <span className="difficulty-badge capitalize">{q.difficulty}</span>
                        )}
                      </div>
                      
                      <h3 className="question-text">{q.question}</h3>

                      <div className="options-grid review">
                        {q.options.map((option, i) => {
                          const isUserSelected = userAnswer === option;
                          const isCorrectOption = correctAnswer === option;
                          
                          let optionClass = "";
                          if (isUserSelected) {
                            optionClass = isCorrect ? "correct-option" : "incorrect-option";
                          } else if (isCorrectOption) {
                            optionClass = "missed-correct-option";
                          }

                          return (
                            <div
                              key={i}
                              className={`option-row-card review-row ${optionClass}`}
                            >
                              <span className="option-letter">{String.fromCharCode(65 + i)}</span>
                              <span className="option-text">{option}</span>
                              {isUserSelected && (
                                <span className="selection-label font-bold text-xs uppercase">
                                  {isCorrect ? "Your Answer (Correct)" : "Your Answer"}
                                </span>
                              )}
                              {isCorrectOption && !isUserSelected && (
                                <span className="selection-label font-bold text-xs uppercase correct-label">
                                  Correct Answer
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {q.explanation && (
                        <div className="explanation-accordion-wrapper">
                          <button
                            className="btn-explanation-toggle"
                            onClick={() => toggleExplanation(index)}
                          >
                            <span>{showExplanation ? "Hide Explanation" : "Show AI Explanation"}</span>
                            <span className={`arrow-icon ${showExplanation ? "up" : "down"}`}>▼</span>
                          </button>
                          
                          {showExplanation && (
                            <div className="explanation-content-panel">
                              <strong>Concept Analysis:</strong>
                              <p>{q.explanation}</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="result-actions-footer">
              <button onClick={resetQuiz} className="btn">
                Close Review
              </button>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default Quiz;