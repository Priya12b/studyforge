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
      subject: req.body.subject,
      topic: req.body.topic,
      generatedPlan: aiResult,
      aiSuggestions: "AI generated study plan",
    });

    res.status(200).json({
      success: true,
      data: savedPlan,
    });
  } catch (error) {
    console.log(error);

    res.status(500).json({
      message: "Planner generation failed",
    });
  }
};

module.exports = {
  generatePlan,
};