const Task = require("../models/Task");
const Quiz = require("../models/Quiz");
const StudyPlan = require("../models/StudyPlan");
const Analytics = require("../models/Analytics");

const {
  getAttendanceSummary,
} = require("./attendanceService");

const getDashboardData = async (
  userId
) => {
  try {
    // TASKS
    const totalTasks =
      await Task.countDocuments({
        userId,
      });

    const completedTasks =
      await Task.countDocuments({
        userId,
        completed: true,
      });

    const pendingTasks =
      await Task.countDocuments({
        userId,
        completed: false,
      });

    // QUIZZES
    const quizzes = await Quiz.find({
      userId,
    });

    const totalQuizzes =
      quizzes.length;

    const averageScore =
      totalQuizzes > 0
        ? quizzes.reduce(
          (acc, quiz) =>
            acc + quiz.score,
          0
        ) / totalQuizzes
        : 0;

    // STUDY PLANS
    const totalPlans =
      await StudyPlan.countDocuments({
        userId,
      });

    // ANALYTICS
    const analytics =
      await Analytics.findOne({
        userId,
      });

    const attendanceSummary = await getAttendanceSummary(userId);

    return {
      tasks: {
        totalTasks,
        completedTasks,
        pendingTasks,
      },

      quizzes: {
        totalQuizzes,
        averageScore,
      },

      studyPlans: {
        totalPlans,
      },

      analytics,

      attendance: {
        summary: attendanceSummary,
        recentRecords: attendanceSummary.recentRecords,
      },
    };
  } catch (error) {
    console.error("[DashboardService] getDashboardData failed:", error.message || error);

    throw error;
  }
};

module.exports = {
  getDashboardData,
};