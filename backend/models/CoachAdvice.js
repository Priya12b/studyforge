const mongoose = require("mongoose");

const coachAdviceSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    coachMessage: {
      type: String,
      required: true,
    },
    priorityActions: {
      type: [String],
      default: [],
    },
    studyTip: {
      type: String,
      default: "",
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("CoachAdvice", coachAdviceSchema);
