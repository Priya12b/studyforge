const express = require("express");

const router = express.Router();

const protect = require("../middleware/authMiddleware");

const {
  generatePlan,
} = require("../controllers/plannerController");

router.post("/generate", protect, generatePlan);

module.exports = router;