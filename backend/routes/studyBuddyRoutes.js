const express = require("express");
const router = express.Router();
const protect = require("../middleware/authMiddleware");
const { getProfile, updateProfile, getMatches, sendInvite } = require("../controllers/studyBuddyController");

router.get("/profile", protect, getProfile);
router.put("/profile", protect, updateProfile);
router.get("/matches", protect, getMatches);
router.post("/invite", protect, sendInvite);

module.exports = router;
