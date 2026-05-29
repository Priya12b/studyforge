const express = require("express");

const router = express.Router();

const protect = require("../middleware/authMiddleware");

const {
    sendChatbotMessage,
} = require("../controllers/chatbotController");

router.post("/", protect, sendChatbotMessage);

module.exports = router;