import {
  useState,
} from "react";

import Layout from "../components/Layout";
import API from "../services/api";

import "../styles/quiz.css";

const Quiz = () => {
  const [subject, setSubject] =
    useState("");

  const [topic, setTopic] =
    useState("");

  const [quiz, setQuiz] =
    useState(null);

  const [answers, setAnswers] =
    useState([]);

  const [result, setResult] =
    useState(null);

  const generateQuiz =
    async () => {
      if (!subject.trim() || !topic.trim()) {
        alert("Please enter both subject and topic");
        return;
      }

      try {
        const res =
          await API.post(
            "/quiz/generate",
            {
              subject,
              topic,
            }
          );

        setQuiz(res.data);
      } catch (error) {
        console.log(error);
      }
    };

  const handleAnswer = (
    index,
    value
  ) => {
    const updated =
      [...answers];

    updated[index] = value;

    setAnswers(updated);
  };

  const submitQuiz =
    async () => {
      if (!quiz?._id) {
        alert("Generate a quiz first");
        return;
      }

      try {
        const res =
          await API.post(
            `/quiz/submit/${quiz._id}`,
            {
              answers,
            }
          );

        setResult(res.data);
      } catch (error) {
        console.log(error);
      }
    };

  return (
    <Layout>
      <div className="quiz-container">
        <div>
          <span className="eyebrow">AI Quiz Studio</span>
          <h1>Adaptive Quiz Generator</h1>
          <p className="muted">Create topic-wise quizzes, then submit answers to see scores and weak areas.</p>
        </div>

        <div className="quiz-form surface page-card">
          <input
            className="input"
            type="text"
            placeholder="Subject"
            onChange={(e) =>
              setSubject(
                e.target.value
              )
            }
          />

          <input
            className="input"
            type="text"
            placeholder="Topic"
            onChange={(e) =>
              setTopic(
                e.target.value
              )
            }
          />

          <button
            onClick={generateQuiz}
            className="btn"
          >
            Generate Quiz
          </button>
        </div>

        {quiz && (
          <div className="quiz-card">
            {quiz.questions.map(
              (q, index) => (
                <div key={index} className="question-card">
                  <h3>
                    {q.question}
                  </h3>

                  {q.options.map(
                    (
                      option,
                      i
                    ) => (
                      <label
                        key={i}
                        className="option-row"
                      >
                        <input
                          type="radio"
                          name={`question-${index}`}
                          value={
                            option
                          }
                          onChange={(
                            e
                          ) =>
                            handleAnswer(
                              index,
                              e
                                .target
                                .value
                            )
                          }
                        />

                        {option}
                      </label>
                    )
                  )}
                </div>
              )
            )}

            <button
              onClick={submitQuiz}
              className="btn"
            >
              Submit Quiz
            </button>
          </div>
        )}

        {result && (
          <div className="result-card">
            <h2>
              Score:
              {result.score}
            </h2>

            <h3>
              Weak Topics:
            </h3>

            {result.weakTopics.map(
              (
                topic,
                index
              ) => (
                <p key={index}>
                  {topic}
                </p>
              )
            )}
          </div>
        )}
      </div>
    </Layout>
  );
};

export default Quiz;