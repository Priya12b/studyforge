/**
 * Chatbot Controller
 *
 * Uses the real AI chat agent for conversational tutoring
 * instead of the old mock study plan formatter.
 */

const { chatWithAI } = require("../integrations/aiService");

const sendChatbotMessage = async (req, res) => {
  try {
    const { message = "" } = req.body;

    if (!message.trim()) {
      return res.status(400).json({
        message: "Message is required",
      });
    }

    const aiResponse = await chatWithAI({
      user_id: req.user?.id || "anonymous",
      message,
      model: req.body.model,
      provider: req.body.provider,
    });

    res.status(200).json({
      success: true,
      reply: aiResponse.reply,
      session_id: aiResponse.session_id,
    });
  } catch (error) {
    console.error("[Chatbot] Error:", error.message);

    res.status(500).json({
      message: "Chatbot failed",
    });
  }
};

module.exports = {
  sendChatbotMessage,
};