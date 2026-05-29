const mongoose = require("mongoose");

const quizSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    subject: String,

    topic: String,

    questions: [
      {
        question: String,

        options: [String],

        correctAnswer: String,

        userAnswer: String,
      },
    ],

    score: {
      type: Number,
      default: 0,
    },

    weakTopics: [String],
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Quiz", quizSchema);