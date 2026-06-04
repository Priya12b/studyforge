const express = require("express");
const router = express.Router();
const protect = require("../middleware/authMiddleware");
const { generateRevisionScheduleController } = require("../controllers/revisionController");

router.post("/generate", protect, generateRevisionScheduleController);

module.exports = router;
