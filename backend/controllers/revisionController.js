const aiService = require("../integrations/aiService");
const Analytics = require("../models/Analytics");
const Task = require("../models/Task");

const generateRevisionScheduleController = async (req, res) => {
  try {
    const { topics_studied, daily_capacity_minutes } = req.body;

    const analytics = await Analytics.findOne({ userId: req.user.id });
    const weak_topics = analytics?.weakTopics || [];

    const completedTasks = await Task.find({ userId: req.user.id, completed: true })
      .sort({ createdAt: -1 })
      .limit(10);
    
    const study_history = completedTasks.map(task => ({
      activity: task.title,
      description: task.description,
      date: task.dueDate || task.createdAt,
    }));

    const data = {
      userId: req.user.id,
      topics_studied: topics_studied || [],
      study_history: study_history,
      weak_topics: weak_topics,
      daily_capacity_minutes: daily_capacity_minutes ? parseInt(daily_capacity_minutes) : 120,
    };

    const scheduleData = await aiService.generateRevisionSchedule(data);
    res.status(200).json(scheduleData);
  } catch (error) {
    console.error("[RevisionController] Action failed:", error.message);
    res.status(500).json({ message: "Revision schedule generation failed" });
  }
};

module.exports = {
  generateRevisionScheduleController,
};
