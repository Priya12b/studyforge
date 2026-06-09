const User = require("../models/User");
const Notes = require("../models/Notes");
const Quiz = require("../models/Quiz");
const AdminSettings = require("../models/AdminSettings");
const { getAIStatus } = require("../integrations/aiService");

// GET /api/admin/metrics
const getAdminMetrics = async (req, res) => {
  try {
    const [totalUsers, totalNotes, totalQuizzes, usersList] = await Promise.all([
      User.countDocuments(),
      Notes.countDocuments(),
      Quiz.countDocuments(),
      User.find().select("-password").sort({ createdAt: -1 }),
    ]);

    // Fetch AI Service status
    const aiStatus = await getAIStatus();

    // Node process status
    const uptimeSeconds = process.uptime();
    const serverEnv = process.env.NODE_ENV || "development";

    res.status(200).json({
      success: true,
      metrics: {
        totalUsers,
        totalNotes,
        totalQuizzes,
      },
      system: {
        serverEnv,
        uptimeSeconds,
        aiService: aiStatus,
      },
      users: usersList,
    });
  } catch (error) {
    console.error("[adminController] getAdminMetrics failed:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve administrative metrics",
      error: error.message,
    });
  }
};

// GET /api/admin/settings
const getAdminSettings = async (req, res) => {
  try {
    let promptSettings = await AdminSettings.findOne({ key: "prompt_templates" });
    if (!promptSettings) {
      // Return defaults if none are stored yet
      promptSettings = {
        key: "prompt_templates",
        value: {
          STUDY_PLANNER_PROMPT_SYSTEM: "You are a study planner AI. Generate a 5-7 day study schedule ONLY...",
          AI_TUTOR_PROMPT_SYSTEM: "You are an expert academic tutor AI. Your role is to help students understand concepts clearly...",
          QUIZ_GENERATOR_PROMPT_SYSTEM: "You are an expert quiz generator for academic subjects...",
        },
      };
    }

    res.status(200).json({
      success: true,
      settings: promptSettings.value,
    });
  } catch (error) {
    console.error("[adminController] getAdminSettings failed:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve settings",
    });
  }
};

// POST /api/admin/settings
const updateAdminSettings = async (req, res) => {
  try {
    const { settings } = req.body;
    if (!settings) {
      return res.status(400).json({ success: false, message: "Settings payload required" });
    }

    const updated = await AdminSettings.findOneAndUpdate(
      { key: "prompt_templates" },
      { key: "prompt_templates", value: settings },
      { new: true, upsert: true }
    );

    res.status(200).json({
      success: true,
      message: "Administrative settings updated successfully",
      settings: updated.value,
    });
  } catch (error) {
    console.error("[adminController] updateAdminSettings failed:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to update settings",
    });
  }
};

module.exports = {
  getAdminMetrics,
  getAdminSettings,
  updateAdminSettings,
};
