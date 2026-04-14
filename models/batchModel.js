const mongoose = require("mongoose");

const batchSchema = new mongoose.Schema(
  {
    teacher: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Teacher",
      required: true,
    },
    batchName: {
      type: String,
      required: true,
      trim: true,
    },
    batchCode: {
      type: String,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    courses: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Course",
      },
    ],
    students: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    startDate: {
      type: Date,
    },
    endDate: {
      type: Date,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
    deletedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

batchSchema.index({ teacher: 1, batchName: 1 }, { unique: true });

module.exports = mongoose.model("Batch", batchSchema);
