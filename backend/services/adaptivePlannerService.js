const Analytics = require("../models/Analytics");

const Quiz = require("../models/Quiz");

const getAdaptiveData = async (
  userId
) => {
  try {
    const analytics =
      await Analytics.findOne({
        userId,
      });

    const quizzes = await Quiz.find({
      userId,
    });

    let averageScore = 0;

    if (quizzes.length > 0) {
      averageScore =
        quizzes.reduce(
          (acc, quiz) =>
            acc + quiz.score,
          0
        ) / quizzes.length;
    }

    return {
      weakTopics:
        analytics?.weakTopics || [],

      tasksCompleted:
        analytics?.tasksCompleted || 0,

      streak:
        analytics?.streak || 0,

      averageScore,
    };
  } catch (error) {
    console.log(error);

    throw error;
  }
};

module.exports = {
  getAdaptiveData,
};