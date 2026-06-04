const express = require("express");
const router = express.Router();
const protect = require("../middleware/authMiddleware");
const { getAnalytics, getAIPerformance } = require("../controllers/analyticsController");

router.get("/", protect, getAnalytics);
router.post("/performance", protect, getAIPerformance);

module.exports = router;