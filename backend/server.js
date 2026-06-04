const express = require("express");
const cors = require("cors");

const app = express();

const rateLimit = require("express-rate-limit");

require("dotenv").config();

const connectDB = require("./config/db");

connectDB();

const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per window
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: "Too many requests from this IP, please try again after 15 minutes" },
});

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 15, // Limit each IP to 15 authentication attempts per window
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: "Too many authentication attempts, please try again after 15 minutes" },
});

app.use(globalLimiter);
app.use(cors({
    origin: [process.env.FRONTEND_URL || "http://localhost:5173"],
    credentials: true,
}));
app.use(express.json({ limit: "1mb" }));
app.use("/api/auth", authLimiter);

const authRoutes = require("./routes/authRoutes");
const plannerRoutes = require("./routes/plannerRoutes");
const taskRoutes = require("./routes/taskRoutes");
const analyticsRoutes = require("./routes/analyticsRoutes");
const quizRoutes = require("./routes/quizRoutes");
const dashboardRoutes = require("./routes/dashboardRoutes");
const adaptiveRoutes = require("./routes/adaptiveRoutes");
const uploadRoutes = require("./routes/uploadRoutes");
const gamificationRoutes = require("./routes/gamificationRoutes");
const attendanceRoutes = require("./routes/attendanceRoutes");
const chatbotRoutes = require("./routes/chatbotRoutes");
const flashcardRoutes = require("./routes/flashcardRoutes");
const revisionRoutes = require("./routes/revisionRoutes");

app.use("/api/auth", authRoutes);
app.use("/api/planner", plannerRoutes);
app.use("/api/tasks", taskRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/quiz", quizRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/adaptive", adaptiveRoutes);
app.use("/api/upload", uploadRoutes);
app.use("/api/gamification", gamificationRoutes);
app.use("/api/attendance", attendanceRoutes);
app.use("/api/chatbot", chatbotRoutes);
app.use("/api/flashcards", flashcardRoutes);
app.use("/api/revision", revisionRoutes);
app.use("/uploads", express.static("uploads"));

app.get("/", (req, res) => {
    res.send("Backend Running");
});

app.listen(process.env.PORT, () => {
    console.log(`Server running on port ${process.env.PORT}`);
});