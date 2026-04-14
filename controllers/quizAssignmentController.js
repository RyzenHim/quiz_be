const Batch = require("../models/batchModel");
const Course = require("../models/courseModel");
const QuizAssignment = require("../models/quizAssignmentModel");
const User = require("../models/userModel");

const getValidatedStudents = async ({ teacherId, batch, studentIds, assignToAllStudents }) => {
  if (assignToAllStudents) {
    return batch.students;
  }

  if (!Array.isArray(studentIds) || studentIds.length === 0) {
    throw new Error("Select at least one student or use assignToAllStudents");
  }

  const students = await User.find({
    _id: { $in: studentIds },
    teacher: teacherId,
    batch: batch._id,
    isDeleted: false,
  }).select("_id");

  if (students.length !== studentIds.length) {
    throw new Error("One or more students do not belong to the selected batch");
  }

  return students.map((student) => student._id);
};

exports.createQuizAssignment = async (req, res) => {
  try {
    const {
      title,
      description,
      course: courseId,
      batch: batchId,
      studentIds = [],
      assignToAllStudents = false,
      durationInMinutes,
      totalMarks,
      startAt,
      endAt,
      status,
    } = req.body;

    if (!title || !courseId || !batchId || !durationInMinutes) {
      return res.status(400).json({
        message: "title, course, batch and durationInMinutes are required",
      });
    }

    const course = await Course.findOne({
      _id: courseId,
      teacher: req.teacher._id,
      isDeleted: false,
    });

    if (!course) {
      return res.status(404).json({ message: "Course not found" });
    }

    const batch = await Batch.findOne({
      _id: batchId,
      teacher: req.teacher._id,
      isDeleted: false,
    });

    if (!batch) {
      return res.status(404).json({ message: "Batch not found" });
    }

    const batchHasCourse = batch.courses.some((courseRef) => String(courseRef) === String(courseId));

    if (!batchHasCourse) {
      return res.status(400).json({
        message: "Selected batch is not aligned with the selected course",
      });
    }

    const students = await getValidatedStudents({
      teacherId: req.teacher._id,
      batch,
      studentIds,
      assignToAllStudents,
    });

    const quizAssignment = await QuizAssignment.create({
      teacher: req.teacher._id,
      title,
      description,
      course: courseId,
      batch: batchId,
      students,
      assignToAllStudents,
      durationInMinutes,
      totalMarks,
      startAt,
      endAt,
      status,
    });

    const populatedAssignment = await QuizAssignment.findById(quizAssignment._id)
      .populate("course")
      .populate("batch")
      .populate("students", "-password");

    return res.status(201).json({
      message: "Quiz assignment created successfully",
      quizAssignment: populatedAssignment,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

exports.getQuizAssignments = async (req, res) => {
  try {
    const quizAssignments = await QuizAssignment.find({
      teacher: req.teacher._id,
    })
      .populate("course")
      .populate("batch")
      .populate("students", "-password")
      .sort({ createdAt: -1 });

    return res.status(200).json({ quizAssignments });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

exports.getQuizAssignmentById = async (req, res) => {
  try {
    const quizAssignment = await QuizAssignment.findOne({
      _id: req.params.id,
      teacher: req.teacher._id,
    })
      .populate("course")
      .populate("batch")
      .populate("students", "-password");

    if (!quizAssignment) {
      return res.status(404).json({ message: "Quiz assignment not found" });
    }

    return res.status(200).json({ quizAssignment });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};
