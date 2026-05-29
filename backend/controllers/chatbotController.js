const {
    generateStudyPlan,
} = require("../integrations/aiService");

const sendChatbotMessage = async (req, res) => {
    try {
        const { message = "" } = req.body;

        if (!message.trim()) {
            return res.status(400).json({
                message: "Message is required",
            });
        }

        const aiResponse = await generateStudyPlan({
            topic: message,
        });

        const reply = `I can help you with ${message}. Quick plan: ${aiResponse.study_plan
            .map((item) => `${item.day}: ${item.task}`)
            .join(" | ")}`;

        res.status(200).json({
            success: true,
            reply,
        });
    } catch (error) {
        console.log(error);

        res.status(500).json({
            message: "Chatbot failed",
        });
    }
};

module.exports = {
    sendChatbotMessage,
};