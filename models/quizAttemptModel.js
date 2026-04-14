const mongoose = require("mongoose");

const attemptedAnswerSchema = new mongoose.Schema(
  {
    question: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Question",
      required: true,
    },
    selectedOptionIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
      },
    ],
    answerText: {
      type: String,
      trim: true,
    },
    isCorrect: {
      type: Boolean,
      default: false,
    },
    obtainedMarks: {
      type: Number,
      default: 0,
    },
  },
  {
    _id: false,
  }
);

const quizAttemptSchema = new mongoose.Schema(
  {
    quizAssignment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "QuizAssignment",
      required: true,
    },
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
    answers: [attemptedAnswerSchema],
    score: {
      type: Number,
      default: 0,
    },
    totalMarks: {
      type: Number,
      default: 0,
    },
    percentage: {
      type: Number,
      default: 0,
    },
    isPassed: {
      type: Boolean,
      default: false,
    },
    startedAt: {
      type: Date,
      default: Date.now,
    },
    submittedAt: {
      type: Date,
    },
    status: {
      type: String,
      enum: ["in_progress", "submitted", "evaluated"],
      default: "submitted",
    },
  },
  {
    timestamps: true,
  }
);

quizAttemptSchema.index({ quizAssignment: 1, student: 1 }, { unique: true });

module.exports = mongoose.model("QuizAttempt", quizAttemptSchema);
