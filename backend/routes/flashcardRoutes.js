const express = require("express");
const router = express.Router();
const protect = require("../middleware/authMiddleware");
const { generateFlashcardsController } = require("../controllers/flashcardController");

router.post("/generate", protect, generateFlashcardsController);

module.exports = router;
