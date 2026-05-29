const express = require("express");

const router = express.Router();

const protect = require("../middleware/authMiddleware");

const {
  generateQuizController,
  submitQuiz,
} = require("../controllers/quizController");

router.post(
  "/generate",
  protect,
  generateQuizController
);

router.post(
  "/submit/:id",
  protect,
  submitQuiz
);

module.exports = router;