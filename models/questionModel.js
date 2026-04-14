const mongoose = require("mongoose");

const questionOptionSchema = new mongoose.Schema(
  {
    text: {
      type: String,
      required: true,
      trim: true,
    },
    isCorrect: {
      type: Boolean,
      default: false,
    },
  },
  {
    _id: true,
  }
);

const questionSchema = new mongoose.Schema(
  {
    teacher: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Teacher",
      required: true,
    },
    skill: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Skill",
      required: true,
    },
    topicId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    topicTitle: {
      type: String,
      required: true,
      trim: true,
    },
    type: {
      type: String,
      enum: ["mcq", "true_false", "short_answer"],
      default: "mcq",
    },
    questionText: {
      type: String,
      required: true,
      trim: true,
    },
    options: [questionOptionSchema],
    correctAnswerText: {
      type: String,
      trim: true,
    },
    marks: {
      type: Number,
      required: true,
      min: 1,
      default: 1,
    },
    difficulty: {
      type: String,
      enum: ["easy", "medium", "hard"],
      default: "medium",
    },
    explanation: {
      type: String,
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Question", questionSchema);
