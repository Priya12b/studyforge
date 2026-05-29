const {
  generateStudyPlan,
} = require("../integrations/aiService");

const runPlannerWorkflow = async (user, data) => {
  try {
    // prepare payload
    const payload = {
      user_id: user.id,
      ...data,
    };

    // call AI service
    const aiResponse = await generateStudyPlan(payload);

    return aiResponse;
  } catch (error) {
    console.log(error.message);

    throw error;
  }
};

module.exports = {
  runPlannerWorkflow,
};