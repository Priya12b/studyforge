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
    console.log(error);

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
          weakTopics.push(quiz.topic);
        }
      }
    );

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
      console.log(rewardError);
    }

    res.status(200).json({
      score,
      weakTopics,
      quiz,
      gamification,
    });
  } catch (error) {
    console.log(error);

    res.status(500).json({
      message: "Quiz submission failed",
    });
  }
};

module.exports = {
  generateQuizController,
  submitQuiz,
};