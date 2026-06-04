const Analytics = require("../models/Analytics");
const Task = require("../models/Task");
const Quiz = require("../models/Quiz");
const aiService = require("../integrations/aiService");

const getAnalytics = async (req, res) => {
  try {
    const analytics = await Analytics.findOne({
      userId: req.user.id,
    });

    res.status(200).json(analytics);
  } catch (error) {
    console.error("[AnalyticsController] Action failed:", error.message);

    res.status(500).json({
      message: "Failed to fetch analytics",
    });
  }
};

const getAIPerformance = async (req, res) => {
  try {
    const days_to_analyze = req.body.days_to_analyze ? parseInt(req.body.days_to_analyze) : 7;
    
    // Fetch study logs (completed tasks)
    const completedTasks = await Task.find({
      userId: req.user.id,
      completed: true,
      updatedAt: { $gte: new Date(Date.now() - days_to_analyze * 24 * 60 * 60 * 1000) }
    });
    
    const study_logs = completedTasks.map(task => ({
      subject: "General",
      topic: task.title,
      duration_minutes: 60, // approximate duration per task
      timestamp: task.updatedAt.toISOString(),
    }));

    // Fetch quiz scores
    const quizzes = await Quiz.find({
      userId: req.user.id,
      createdAt: { $gte: new Date(Date.now() - days_to_analyze * 24 * 60 * 60 * 1000) }
    });

    const quiz_scores = quizzes.map(quiz => ({
      subject: quiz.subject || "General",
      topic: quiz.topic || "General",
      score: quiz.score || 0,
      total_questions: quiz.questions?.length || 5,
      timestamp: quiz.createdAt.toISOString(),
    }));

    const data = {
      userId: req.user.id,
      study_logs,
      quiz_scores,
      days_to_analyze,
    };

    const aiPerformance = await aiService.analyzePerformance(data);
    res.status(200).json(aiPerformance);
  } catch (error) {
    console.error("[AnalyticsController] Action failed:", error.message);
    res.status(500).json({ message: "Failed to get AI performance analytics" });
  }
};

module.exports = {
  getAnalytics,
  getAIPerformance,
};