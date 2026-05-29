const express = require("express");

const router = express.Router();

const protect = require("../middleware/authMiddleware");

const {
  generateAdaptivePlan,
} = require(
  "../controllers/adaptiveController"
);

router.post(
  "/generate",
  protect,
  generateAdaptivePlan
);

module.exports = router;