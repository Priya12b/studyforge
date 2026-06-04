const express = require("express");
const router = express.Router();
const protect = require("../middleware/authMiddleware");

const {
  generatePlan,
  getLatestPlan,
  getAllPlans,
  deletePlan,
  getPlanById,
} = require("../controllers/plannerController");

router.post("/generate", protect, generatePlan);
router.get("/latest", protect, getLatestPlan);
router.get("/history", protect, getAllPlans);
router.get("/:id", protect, getPlanById);
router.delete("/:id", protect, deletePlan);

module.exports = router;