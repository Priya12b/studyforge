const Analytics = require("../models/Analytics");
const Quiz = require("../models/Quiz");
const Task = require("../models/Task");
const CoachAdvice = require("../models/CoachAdvice");
const aiService = require("../integrations/aiService");

const generateAdvice = async (req, res) => {
  try {
    const userId = req.user.id;

    // 1. Fetch user analytics
    const analytics = await Analytics.findOne({ userId });

    // 2. Fetch recent quizzes
    const quizzes = await Quiz.find({ userId })
      .sort({ createdAt: -1 })
      .limit(10);

    const quiz_history = quizzes.map((q) => ({
      subject: q.subject || "General",
      topic: q.topic || "General",
      score: q.score || 0,
      total_questions: q.questions?.length || 5,
      timestamp: q.createdAt,
    }));

    // 3. Fetch recent tasks
    const tasks = await Task.find({ userId })
      .sort({ createdAt: -1 })
      .limit(20);

    const task_history = tasks.map((t) => ({
      title: t.title,
      description: t.description || "",
      completed: t.completed,
      priority: t.priority,
      dueDate: t.dueDate,
    }));

    // 4. Gather weak topics
    const weak_topics = new Set(analytics?.weakTopics || []);

    // Also look at quizzes with <60% score
    quizzes.forEach((q) => {
      const total = q.questions?.length || 5;
      const scorePercent = (q.score / total) * 100;
      if (scorePercent < 60 && q.topic) {
        weak_topics.add(q.topic);
      }
    });

    const weak_topics_list = Array.from(weak_topics);

    // Get model preferences from request headers or body if available
    const model = req.body.model || null;
    const provider = req.body.provider || null;

    const payload = {
      userId,
      analytics: analytics
        ? {
            studyHours: analytics.studyHours,
            tasksCompleted: analytics.tasksCompleted,
            streak: analytics.streak,
          }
        : {},
      quiz_history,
      task_history,
      weak_topics: weak_topics_list,
      model,
      provider,
    };

    console.log(`[CoachController] Requesting coaching assessment for user: ${userId}`);
    const aiResponse = await aiService.generateCoachAdvice(payload);

    // Save to DB
    const adviceRecord = await CoachAdvice.create({
      userId,
      coachMessage: aiResponse.coach_message,
      priorityActions: aiResponse.priority_actions,
      studyTip: aiResponse.study_tip,
    });

    res.status(200).json({
      success: true,
      data: adviceRecord,
    });
  } catch (error) {
    console.error("[CoachController] generateAdvice failed:", error.message);
    res.status(500).json({
      message: "Failed to generate coaching insights",
      error: error.message,
    });
  }
};

const getAdviceHistory = async (req, res) => {
  try {
    const userId = req.user.id;
    const history = await CoachAdvice.find({ userId }).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: history,
    });
  } catch (error) {
    console.error("[CoachController] getAdviceHistory failed:", error.message);
    res.status(500).json({
      message: "Failed to fetch coaching history",
    });
  }
};

module.exports = {
  generateAdvice,
  getAdviceHistory,
};
