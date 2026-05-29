const express = require("express");

const router = express.Router();

const protect = require("../middleware/authMiddleware");

const {
    markAttendance,
    getMyAttendance,
} = require("../controllers/attendanceController");

router.post("/mark", protect, markAttendance);

router.get("/me", protect, getMyAttendance);

module.exports = router;