const express = require("express");
const router = express.Router();
const protect = require("../middleware/authMiddleware");

const {
  getPublicKey,
  subscribe,
  unsubscribe,
  sendTestNotification,
} = require("../controllers/notificationController");

// Retrieve public key
router.get("/key", getPublicKey);

// Subscribe & unsubscribe (protected)
router.post("/subscribe", protect, subscribe);
router.post("/unsubscribe", protect, unsubscribe);

// Test notification (protected)
router.post("/test", protect, sendTestNotification);

module.exports = router;
