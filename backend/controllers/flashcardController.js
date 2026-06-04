const aiService = require("../integrations/aiService");

const generateFlashcardsController = async (req, res) => {
  try {
    const { subject, topic, num_cards } = req.body;
    if (!subject) {
      return res.status(400).json({ message: "Subject is required" });
    }

    const data = {
      userId: req.user.id,
      subject,
      topic: topic || "",
      num_cards: num_cards ? parseInt(num_cards) : 10,
    };

    const flashcardsData = await aiService.generateFlashcards(data);
    res.status(200).json(flashcardsData);
  } catch (error) {
    console.error("[FlashcardController] Action failed:", error.message);
    res.status(500).json({ message: "Flashcard generation failed" });
  }
};

module.exports = {
  generateFlashcardsController,
};
