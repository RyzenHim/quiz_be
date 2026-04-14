const mongoose = require("mongoose");

const quizAssignmentSchema = new mongoose.Schema(
  {
    teacher: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Teacher",
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    instructions: {
      type: String,
      trim: true,
    },
    course: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Course",
      required: true,
    },
    batch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Batch",
      required: true,
    },
    students: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    questions: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Question",
      },
    ],
    assignToAllStudents: {
      type: Boolean,
      default: false,
    },
    durationInMinutes: {
      type: Number,
      required: true,
      min: 1,
    },
    totalMarks: {
      type: Number,
      min: 1,
      default: 100,
    },
    passMarks: {
      type: Number,
      min: 0,
      default: 0,
    },
    startAt: {
      type: Date,
    },
    endAt: {
      type: Date,
    },
    status: {
      type: String,
      enum: ["draft", "scheduled", "published", "completed", "cancelled"],
      default: "draft",
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("QuizAssignment", quizAssignmentSchema);
