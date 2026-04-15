const mongoose = require("mongoose");

const practiceAttemptSchema = new mongoose.Schema(
  {
    teacher: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Teacher",
      required: true,
    },
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    course: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Course",
      required: true,
    },
    skill: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Skill",
      default: null,
    },
    topicId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    topicTitle: {
      type: String,
      trim: true,
      default: "",
    },
    question: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Question",
      required: true,
    },
    questionText: {
      type: String,
      required: true,
      trim: true,
    },
    selectedOptionIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
      },
    ],
    answerText: {
      type: String,
      trim: true,
      default: "",
    },
    isCorrect: {
      type: Boolean,
      default: false,
    },
    explanation: {
      type: String,
      trim: true,
      default: "",
    },
    submittedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

practiceAttemptSchema.index({ student: 1, createdAt: -1 });
practiceAttemptSchema.index({ teacher: 1, createdAt: -1 });

module.exports = mongoose.model("PracticeAttempt", practiceAttemptSchema);
