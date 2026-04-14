const Batch = require("../models/batchModel");
const Course = require("../models/courseModel");

const validateCourseIds = async (teacherId, courseIds = []) => {
  if (!Array.isArray(courseIds) || courseIds.length === 0) {
    return [];
  }

  const courses = await Course.find({
    _id: { $in: courseIds },
    teacher: teacherId,
    isDeleted: false,
  });

  if (courses.length !== courseIds.length) {
    throw new Error("One or more courses are invalid for this teacher");
  }

  return courseIds;
};

exports.createBatch = async (req, res) => {
  try {
    const { batchName, batchCode, description, courses, startDate, endDate } = req.body;

    if (!batchName) {
      return res.status(400).json({ message: "Batch name is required" });
    }

    const normalizedCourses = await validateCourseIds(req.teacher._id, courses);

    const existingBatch = await Batch.findOne({
      teacher: req.teacher._id,
      batchName,
    });

    if (existingBatch) {
      return res.status(400).json({ message: "Batch name already exists" });
    }

    const batch = await Batch.create({
      teacher: req.teacher._id,
      batchName,
      batchCode,
      description,
      courses: normalizedCourses,
      startDate,
      endDate,
    });

    const populatedBatch = await Batch.findById(batch._id)
      .populate("courses")
      .populate("students", "-password");

    return res.status(201).json({
      message: "Batch created successfully",
      batch: populatedBatch,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

exports.getBatches = async (req, res) => {
  try {
    const batches = await Batch.find({
      teacher: req.teacher._id,
      isDeleted: false,
    })
      .populate("courses")
      .populate("students", "-password");

    return res.status(200).json({ batches });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

exports.getBatchById = async (req, res) => {
  try {
    const batch = await Batch.findOne({
      _id: req.params.id,
      teacher: req.teacher._id,
      isDeleted: false,
    })
      .populate("courses")
      .populate("students", "-password");

    if (!batch) {
      return res.status(404).json({ message: "Batch not found" });
    }

    return res.status(200).json({ batch });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

exports.updateBatch = async (req, res) => {
  try {
    if (req.body.courses) {
      req.body.courses = await validateCourseIds(req.teacher._id, req.body.courses);
    }

    const batch = await Batch.findOneAndUpdate(
      {
        _id: req.params.id,
        teacher: req.teacher._id,
        isDeleted: false,
      },
      req.body,
      { new: true, runValidators: true }
    )
      .populate("courses")
      .populate("students", "-password");

    if (!batch) {
      return res.status(404).json({ message: "Batch not found" });
    }

    return res.status(200).json({
      message: "Batch updated successfully",
      batch,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

exports.softDeleteBatch = async (req, res) => {
  try {
    const batch = await Batch.findOneAndUpdate(
      {
        _id: req.params.id,
        teacher: req.teacher._id,
        isDeleted: false,
      },
      {
        isDeleted: true,
        isActive: false,
        deletedAt: new Date(),
      },
      { new: true }
    );

    if (!batch) {
      return res.status(404).json({ message: "Batch not found" });
    }

    return res.status(200).json({ message: "Batch soft deleted successfully", batch });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

exports.hardDeleteBatch = async (req, res) => {
  try {
    const batch = await Batch.findOneAndDelete({
      _id: req.params.id,
      teacher: req.teacher._id,
    });

    if (!batch) {
      return res.status(404).json({ message: "Batch not found" });
    }

    return res.status(200).json({ message: "Batch permanently deleted" });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};
