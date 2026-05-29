const mongoose = require("mongoose");

const studyPlanSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    subject: String,

    topic: String,

    generatedPlan: Object,

    aiSuggestions: String,
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model(
  "StudyPlan",
  studyPlanSchema
);