const express = require("express");
const router = express.Router();

const {
  getAdminMetrics,
  getAdminSettings,
  updateAdminSettings,
} = require("../controllers/adminController");

router.get("/metrics", getAdminMetrics);
router.get("/settings", getAdminSettings);
router.post("/settings", updateAdminSettings);

module.exports = router;
