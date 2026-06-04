const express = require("express");
const router = express.Router();
const protect = require("../middleware/authMiddleware");

const {
  generateQuizController,
  submitQuiz,
  deleteQuiz,
  getQuizHistory,
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

router.get(
  "/history",
  protect,
  getQuizHistory
);

router.delete(
  "/:id",
  protect,
  deleteQuiz
);

module.exports = router;