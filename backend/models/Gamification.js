const mongoose = require("mongoose");

const badgeSchema = new mongoose.Schema(
    {
        key: {
            type: String,
            required: true,
        },

        name: {
            type: String,
            required: true,
        },

        description: String,

        xpAwarded: {
            type: Number,
            default: 0,
        },

        earnedAt: {
            type: Date,
            default: Date.now,
        },
    },
    {
        _id: false,
    }
);

const gamificationSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            unique: true,
            index: true,
        },

        xp: {
            type: Number,
            default: 0,
        },

        level: {
            type: Number,
            default: 1,
        },

        streak: {
            type: Number,
            default: 0,
        },

        longestStreak: {
            type: Number,
            default: 0,
        },

        lastActivityDate: Date,

        tasksCompleted: {
            type: Number,
            default: 0,
        },

        quizzesCompleted: {
            type: Number,
            default: 0,
        },

        highestQuizScore: {
            type: Number,
            default: 0,
        },

        notesUploaded: {
            type: Number,
            default: 0,
        },

        badges: [badgeSchema],
    },
    {
        timestamps: true,
    }
);

module.exports = mongoose.model("Gamification", gamificationSchema);