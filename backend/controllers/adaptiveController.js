const StudyPlan = require("../models/StudyPlan");

const {
  runAdaptiveWorkflow,
} = require(
  "../workflows/adaptiveWorkflow"
);

const generateAdaptivePlan =
  async (req, res) => {
    try {
      const aiResult =
        await runAdaptiveWorkflow(
          req.user,
          req.body
        );

      const savedPlan =
        await StudyPlan.create({
          userId: req.user.id,

          subject: req.body.subject || (req.body.subjects && req.body.subjects[0]?.name) || "Multi-subject",

          topic: req.body.topic || (req.body.subjects && req.body.subjects[0]?.syllabus_topics?.[0]) || "Custom Plan",

          generatedPlan: aiResult,

          aiSuggestions:
            "Adaptive AI Study Plan",
        });

      res.status(200).json({
        success: true,
        data: savedPlan,
      });
    } catch (error) {
      console.log(error);

      res.status(500).json({
        message:
          "Adaptive planner failed",
      });
    }
  };

module.exports = {
  generateAdaptivePlan,
};