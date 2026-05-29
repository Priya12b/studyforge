import {
  useState,
} from "react";

import Layout from "../components/Layout";
import API from "../services/api";

import "../styles/planner.css";

const Planner = () => {
  const [subject, setSubject] =
    useState("");

  const [topic, setTopic] =
    useState("");

  const [plan, setPlan] =
    useState(null);

  const generatePlan =
    async () => {
      if (!subject.trim() || !topic.trim()) {
        alert("Please enter both subject and topic");
        return;
      }

      try {
        const res =
          await API.post(
            "/adaptive/generate",
            {
              subject,
              topic,
            }
          );

        setPlan(
          res.data.data
            .generatedPlan
        );
      } catch (error) {
        console.log(error);
      }
    };

  return (
    <Layout>
      <div className="planner-container">
        <div>
          <span className="eyebrow">AI Study Planner</span>
          <h1>Plan smarter, revise better</h1>
          <p className="muted">Generate personalized daily study plans, practice suggestions and revisions from any subject-topic pair.</p>
        </div>

        <div className="planner-form surface page-card">
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
            onClick={generatePlan}
            className="btn"
          >
            Generate Plan
          </button>
        </div>

        {plan && (
          <div className="plan-card">
            <h2>Study Plan</h2>

            {plan.study_plan?.map(
              (item, index) => (
                <div key={index} className="plan-day">
                  <h4>
                    {item.day}
                  </h4>

                  <p>
                    {item.task}
                  </p>
                </div>
              )
            )}
          </div>
        )}
      </div>
    </Layout>
  );
};

export default Planner;