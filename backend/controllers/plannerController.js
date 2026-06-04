const StudyPlan = require("../models/StudyPlan");

const {
  runPlannerWorkflow,
} = require("../workflows/plannerWorkflow");

const generatePlan = async (req, res) => {
  try {
    const aiResult = await runPlannerWorkflow(
      req.user,
      req.body
    );

    // save to database
    const savedPlan = await StudyPlan.create({
      userId: req.user.id,
      subject: req.body.subject || (req.body.subjects && req.body.subjects[0]?.name) || "Multi-subject",
      topic: req.body.topic || (req.body.subjects && req.body.subjects[0]?.syllabus_topics?.[0]) || "Custom Plan",
      generatedPlan: aiResult,
      aiSuggestions: "AI generated study plan",
    });

    res.status(200).json({
      success: true,
      data: savedPlan,
    });
  } catch (error) {
    console.error("[PlannerController] Action failed:", error.message);

    res.status(500).json({
      message: "Planner generation failed",
    });
  }
};

const getLatestPlan = async (req, res) => {
  try {
    const latestPlan = await StudyPlan.findOne({ userId: req.user.id })
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: latestPlan,
    });
  } catch (error) {
    console.error("[PlannerController] Action failed:", error.message);
    res.status(500).json({
      message: "Fetching latest plan failed",
    });
  }
};

const getAllPlans = async (req, res) => {
  try {
    const plans = await StudyPlan.find({ userId: req.user.id })
      .sort({ createdAt: -1 })
      .limit(20)
      .select("subject topic createdAt");

    res.status(200).json({
      success: true,
      data: plans,
    });
  } catch (error) {
    console.error("[PlannerController] Action failed:", error.message);
    res.status(500).json({
      message: "Fetching plans history failed",
    });
  }
};

const deletePlan = async (req, res) => {
  try {
    const plan = await StudyPlan.findOneAndDelete({ _id: req.params.id, userId: req.user.id });
    if (!plan) {
      return res.status(404).json({ message: "Plan not found" });
    }
    res.status(200).json({
      success: true,
      message: "Study plan deleted successfully",
    });
  } catch (error) {
    console.error("[PlannerController] Action failed:", error.message);
    res.status(500).json({
      message: "Failed to delete plan",
    });
  }
};

const getPlanById = async (req, res) => {
  try {
    const plan = await StudyPlan.findOne({ _id: req.params.id, userId: req.user.id });
    if (!plan) {
      return res.status(404).json({ message: "Plan not found" });
    }
    res.status(200).json({
      success: true,
      data: plan,
    });
  } catch (error) {
    console.error("[PlannerController] Action failed:", error.message);
    res.status(500).json({
      message: "Fetching plan failed",
    });
  }
};

module.exports = {
  generatePlan,
  getLatestPlan,
  getAllPlans,
  deletePlan,
  getPlanById,
};