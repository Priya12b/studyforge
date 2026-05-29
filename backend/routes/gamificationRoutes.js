const express = require("express");

const router = express.Router();

const protect = require("../middleware/authMiddleware");

const {
    getMyStats,
    getLeaderboardController,
} = require("../controllers/gamificationController");

router.get("/me", protect, getMyStats);

router.get("/leaderboard", protect, getLeaderboardController);

module.exports = router;