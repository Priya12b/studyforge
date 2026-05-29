const Gamification = require("../models/Gamification");

const XP_PER_LEVEL = 100;

const sameDay = (left, right) =>
    left.getFullYear() === right.getFullYear()
    && left.getMonth() === right.getMonth()
    && left.getDate() === right.getDate();

const startOfDay = (date) => {
    const normalized = new Date(date);
    normalized.setHours(0, 0, 0, 0);
    return normalized;
};

const recalculateLevel = (record) => {
    record.level = Math.max(
        1,
        Math.floor(record.xp / XP_PER_LEVEL) + 1
    );
};

const ensureGamification = async (userId) => {
    let record = await Gamification.findOne({ userId });

    if (!record) {
        record = await Gamification.create({ userId });
    }

    return record;
};

const awardBadge = (record, badge) => {
    const alreadyHasBadge = record.badges.some(
        (item) => item.key === badge.key
    );

    if (!alreadyHasBadge) {
        record.badges.push({
            key: badge.key,
            name: badge.name,
            description: badge.description,
            xpAwarded: badge.xpAwarded || 0,
        });

        record.xp += badge.xpAwarded || 0;
    }
};

const updateStreak = (record) => {
    const today = new Date();

    if (!record.lastActivityDate) {
        record.streak = 1;
        record.longestStreak = 1;
        record.lastActivityDate = today;
        return;
    }

    const lastActivity = new Date(record.lastActivityDate);

    if (sameDay(lastActivity, today)) {
        return;
    }

    const diffDays = Math.floor(
        (startOfDay(today) - startOfDay(lastActivity)) / 86400000
    );

    if (diffDays === 1) {
        record.streak += 1;
    } else {
        record.streak = 1;
    }

    record.longestStreak = Math.max(record.longestStreak, record.streak);
    record.lastActivityDate = today;

    if (record.streak > 0 && record.streak % 7 === 0) {
        awardBadge(record, {
            key: `streak-${record.streak}`,
            name: `${record.streak}-Day Streak`,
            description: "Kept the study streak alive.",
            xpAwarded: 50,
        });
    }
};

const saveRecord = async (record) => {
    recalculateLevel(record);
    await record.save();
    return record;
};

const awardTaskCompletion = async (userId) => {
    const record = await ensureGamification(userId);

    updateStreak(record);

    record.tasksCompleted += 1;
    record.xp += 10;

    if (record.tasksCompleted === 1) {
        awardBadge(record, {
            key: "first-task",
            name: "First Win",
            description: "Completed your first task.",
            xpAwarded: 15,
        });
    }

    if (record.tasksCompleted === 10) {
        awardBadge(record, {
            key: "task-crusher",
            name: "Task Crusher",
            description: "Completed 10 tasks.",
            xpAwarded: 25,
        });
    }

    return saveRecord(record);
};

const awardQuizResult = async (userId, score, totalQuestions) => {
    const record = await ensureGamification(userId);
    const percentage = totalQuestions
        ? Math.round((score / totalQuestions) * 100)
        : 0;

    updateStreak(record);

    record.quizzesCompleted += 1;
    record.highestQuizScore = Math.max(record.highestQuizScore, percentage);
    record.xp += 8 + Math.round(percentage / 4);

    if (percentage >= 80) {
        awardBadge(record, {
            key: "quiz-ace",
            name: "Quiz Ace",
            description: "Scored 80% or higher on a quiz.",
            xpAwarded: 20,
        });
    }

    if (percentage === 100) {
        awardBadge(record, {
            key: "perfect-score",
            name: "Perfect Score",
            description: "Answered every quiz question correctly.",
            xpAwarded: 30,
        });
    }

    return saveRecord(record);
};

const awardNotesUpload = async (userId) => {
    const record = await ensureGamification(userId);

    updateStreak(record);

    record.notesUploaded += 1;
    record.xp += 15;

    if (record.notesUploaded === 1) {
        awardBadge(record, {
            key: "note-starter",
            name: "Note Starter",
            description: "Uploaded your first study note.",
            xpAwarded: 10,
        });
    }

    return saveRecord(record);
};

const getMyGamification = async (userId) => {
    const record = await ensureGamification(userId);
    return record.populate("userId", "name email role");
};

const getLeaderboard = async (limit = 10) => {
    return Gamification.find()
        .populate("userId", "name email role")
        .sort({ xp: -1, level: -1, longestStreak: -1 })
        .limit(limit);
};

module.exports = {
    awardTaskCompletion,
    awardQuizResult,
    awardNotesUpload,
    getMyGamification,
    getLeaderboard,
};