const mongoose = require("mongoose");

const notesSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    title: String,

    originalText: String,

    summary: String,

    generatedQuiz: Array,

    generatedPlan: Object,

    filePath: String,
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model(
  "Notes",
  notesSchema
);