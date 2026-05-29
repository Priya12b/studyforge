const {
    getAdaptiveData,
} = require(
    "../services/adaptivePlannerService"
);

const {
    buildAdaptivePrompt,
} = require("../utils/promptBuilder");

const {
    generateStudyPlan,
} = require("../integrations/aiService");

const runAdaptiveWorkflow = async (
    user,
    requestData
) => {
    try {
        // collect analytics
        const adaptiveData =
            await getAdaptiveData(user.id);

        // merge request + analytics
        const finalData = {
            ...adaptiveData,
            ...requestData,
        };

        // build AI prompt
        const prompt =
            buildAdaptivePrompt(
                finalData
            );

        // call AI service
        const aiResponse =
            await generateStudyPlan({
                prompt,
            });

        return aiResponse;
    } catch (error) {
        console.log(error);

        throw error;
    }
};

module.exports = {
    runAdaptiveWorkflow,
};