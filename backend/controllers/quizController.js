const Quiz = require("../models/Quiz");

const {
  runQuizWorkflow,
} = require("../workflows/quizWorkflow");

const {
  updateUserAnalytics,
} = require("../services/analyticsService");

const {
  awardQuizResult,
} = require("../services/gamificationService");


// GENERATE QUIZ
const generateQuizController = async (
  req,
  res
) => {
  try {
    const quizData =
      await runQuizWorkflow(
        req.user,
        req.body
      );

    const savedQuiz = await Quiz.create({
      userId: req.user.id,
      subject: req.body.subject,
      topic: req.body.topic,
      questions: quizData.questions,
    });

    res.status(200).json(savedQuiz);
  } catch (error) {
    console.error("[quizController] generateQuizController failed:", error.message || error);

    res.status(500).json({
      message: "Quiz generation failed",
    });
  }
};


// SUBMIT QUIZ
const submitQuiz = async (req, res) => {
  try {
    const quiz = await Quiz.findById(
      req.params.id
    );

    if (!quiz || String(quiz.userId) !== String(req.user.id)) {
      return res.status(404).json({
        message: "Quiz not found",
      });
    }

    if (!Array.isArray(req.body.answers)) {
      return res.status(400).json({ message: "Answers must be an array" });
    }

    let score = 0;

    let weakTopics = [];

    req.body.answers.forEach(
      (answer, index) => {
        quiz.questions[index].userAnswer =
          answer;

        if (
          answer ===
          quiz.questions[index].correctAnswer
        ) {
          score++;
        } else {
          weakTopics.push(quiz.questions[index]?.topic || quiz.topic);
        }
      }
    );

    // Deduplicate weak topics
    weakTopics = [...new Set(weakTopics)];

    quiz.score = score;
    quiz.weakTopics = weakTopics;

    await quiz.save();

    // update analytics
    await updateUserAnalytics(
      req.user.id,
      {
        weakTopics,
      }
    );

    let gamification = null;

    try {
      gamification = await awardQuizResult(
        req.user.id,
        score,
        quiz.questions.length
      );
    } catch (rewardError) {
      console.error("[quizController] submitQuiz reward failed:", rewardError.message || rewardError);
    }

    res.status(200).json({
      score,
      weakTopics,
      quiz,
      gamification,
    });
  } catch (error) {
    console.error("[quizController] submitQuiz failed:", error.message || error);

    res.status(500).json({
      message: "Quiz submission failed",
    });
  }
};

const deleteQuiz = async (req, res) => {
  try {
    const quiz = await Quiz.findOneAndDelete({ _id: req.params.id, userId: req.user.id });
    if (!quiz) {
      return res.status(404).json({ message: "Quiz not found" });
    }
    res.status(200).json({ success: true, message: "Quiz deleted" });
  } catch (error) {
    console.error("[quizController] deleteQuiz failed:", error.message || error);
    res.status(500).json({ message: "Failed to delete quiz" });
  }
};

const getQuizHistory = async (req, res) => {
  try {
    const quizzes = await Quiz.find({ userId: req.user.id })
      .sort({ createdAt: -1 })
      .limit(20)
      .select("subject topic score questions createdAt");
    res.status(200).json({ success: true, data: quizzes });
  } catch (error) {
    console.error("[quizController] getQuizHistory failed:", error.message || error);
    res.status(500).json({ message: "Failed to fetch quiz history" });
  }
};

module.exports = {
  generateQuizController,
  submitQuiz,
  deleteQuiz,
  getQuizHistory,
};