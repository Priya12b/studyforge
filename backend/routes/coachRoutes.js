const express = require("express");
const router = express.Router();
const protect = require("../middleware/authMiddleware");
const { generateAdvice, getAdviceHistory } = require("../controllers/coachController");

router.post("/advice", protect, generateAdvice);
router.get("/history", protect, getAdviceHistory);

module.exports = router;
