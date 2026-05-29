const express = require("express");

const router = express.Router();

const {
    registerUser,
    loginUser,
    getProfile,
    beginGoogleAuth,
    googleCallback,
} = require("../controllers/authController");

const protect = require("../middleware/authMiddleware");

router.get("/test", (req, res) => {
    res.send("Auth Route Working");
});

router.post("/register", registerUser);
router.post("/login", loginUser);
router.get("/profile", protect, getProfile);

router.get("/google", beginGoogleAuth);
router.get("/google/callback", googleCallback);

module.exports = router;