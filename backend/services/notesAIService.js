/**
 * Notes AI Service
 * 
 * Processes uploaded PDF notes through the AI agent service:
 * - Summarizes extracted text via AI chat
 * - Generates quiz questions from note content  
 * - Generates study plans based on note topics
 */

const {
  chatWithAI,
  generateQuiz,
  generateStudyPlan,
} = require("../integrations/aiService");

const summarizeNotes = async (text) => {
  try {
    // Use the AI chat agent to summarize the extracted PDF text
    const truncatedText = text.slice(0, 3000); // Limit to avoid token overflow

    const result = await chatWithAI({
      message: `Please summarize the following study notes concisely. Highlight the key topics, important concepts, and areas that need revision:\n\n${truncatedText}`,
      subject: "Notes Summary",
    });

    return result.reply;
  } catch (error) {
    console.error("[Notes AI] Summarization error:", error.message);

    // Fallback: return a basic summary if AI fails
    return `Summary:\n${text.slice(0, 300)}\n\nKey Topics:\n- Review uploaded content\n- Practice questions recommended`;
  }
};

const generateQuizFromNotes = async (text) => {
  try {
    // Extract a topic hint from the first 500 chars of the text
    const topicHint = text.slice(0, 500);

    const result = await generateQuiz({
      subject: "Uploaded Notes",
      topic: `Content from notes: ${topicHint.slice(0, 200)}`,
      num_questions: 5,
      difficulty: "mixed",
    });

    return result.questions;
  } catch (error) {
    console.error("[Notes AI] Quiz from notes error:", error.message);

    // Fallback mock quiz
    return [
      {
        question: "What is the main concept from your notes?",
        options: ["Concept A", "Concept B", "Concept C", "Concept D"],
        correctAnswer: "Concept A",
      },
    ];
  }
};

const generatePlanFromNotes = async (text) => {
  try {
    // Extract topic from notes and generate a study plan
    const topicHint = text.slice(0, 300);

    const result = await generateStudyPlan({
      subject: "Uploaded Notes",
      topic: topicHint.slice(0, 100),
      goals: `Create a study plan based on these notes: ${topicHint}`,
    });

    return result;
  } catch (error) {
    console.error("[Notes AI] Plan from notes error:", error.message);

    // Fallback
    return {
      study_plan: [
        { day: "Day 1", task: "Review uploaded notes thoroughly" },
        { day: "Day 2", task: "Practice key concepts" },
        { day: "Day 3", task: "Revise and take practice quiz" },
      ],
    };
  }
};

module.exports = {
  summarizeNotes,
  generateQuizFromNotes,
  generatePlanFromNotes,
};