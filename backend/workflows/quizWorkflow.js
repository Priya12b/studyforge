const {
  generateQuiz,
} = require("../integrations/aiService");

const runQuizWorkflow = async (
  user,
  data
) => {
  try {
    const payload = {
      userId: user.id,
      ...data,
    };

    const quiz = await generateQuiz(payload);

    return quiz;
  } catch (error) {
    console.error("[QuizWorkflow] runQuizWorkflow failed:", error.message || error);

    throw error;
  }
};

module.exports = {
  runQuizWorkflow,
};