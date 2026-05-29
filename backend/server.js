const express = require("express");
const cors = require("cors");

const app = express();

require("dotenv").config();

const connectDB = require("./config/db");

connectDB();

app.use(cors());
app.use(express.json());

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
app.use("/uploads", express.static("uploads"));

app.get("/", (req, res) => {
    res.send("Backend Running");
});

app.listen(process.env.PORT, () => {
    console.log(`Server running on port ${process.env.PORT}`);
});