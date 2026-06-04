const mongoose = require("mongoose");

const analyticsSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    studyHours: {
      type: Number,
      default: 0,
    },

    tasksCompleted: {
      type: Number,
      default: 0,
    },

    weakTopics: [String],

    streak: {
      type: Number,
      default: 0,
    },

    lastActiveDate: Date,
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model(
  "Analytics",
  analyticsSchema
);