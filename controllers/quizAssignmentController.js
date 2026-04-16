const Batch = require("../models/batchModel");
const Course = require("../models/courseModel");
const Question = require("../models/questionModel");
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

const validateQuestionIds = async ({ teacherId, questionIds }) => {
  if (!Array.isArray(questionIds) || questionIds.length === 0) {
    throw new Error("At least one question must be selected for a quiz assignment");
  }

  const questions = await Question.find({
    _id: { $in: questionIds },
    teacher: teacherId,
    isDeleted: false,
  });

  if (questions.length !== questionIds.length) {
    throw new Error("One or more selected questions are invalid");
  }

  return questions;
};

exports.createQuizAssignment = async (req, res) => {
  try {
    const {
      title,
      description,
      instructions,
      course: courseId,
      batch: batchId,
      studentIds = [],
      assignToAllStudents = false,
      questionIds = [],
      durationInMinutes,
      totalMarks,
      passMarks,
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

    const questions = await validateQuestionIds({
      teacherId: req.teacher._id,
      questionIds,
    });

    const computedTotalMarks = questions.reduce((sum, question) => sum + question.marks, 0);

    const quizAssignment = await QuizAssignment.create({
      teacher: req.teacher._id,
      title,
      description,
      instructions,
      course: courseId,
      batch: batchId,
      students,
      questions: questions.map((question) => question._id),
      assignToAllStudents,
      durationInMinutes,
      totalMarks: totalMarks || computedTotalMarks,
      passMarks: passMarks || 0,
      startAt,
      endAt,
      status,
    });

    const populatedAssignment = await QuizAssignment.findById(quizAssignment._id)
      .populate("course")
      .populate("batch")
      .populate("students", "-password")
      .populate({
        path: "questions",
        populate: { path: "skill" },
      });

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
      isDeleted: req.query.deleted === "true",
    })
      .populate("course")
      .populate("batch")
      .populate("students", "-password")
      .populate({
        path: "questions",
        populate: { path: "skill" },
      })
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
      isDeleted: false,
    })
      .populate("course")
      .populate("batch")
      .populate("students", "-password")
      .populate({
        path: "questions",
        populate: { path: "skill" },
      });

    if (!quizAssignment) {
      return res.status(404).json({ message: "Quiz assignment not found" });
    }

    return res.status(200).json({ quizAssignment });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

exports.updateQuizAssignment = async (req, res) => {
  try {
    const existingQuiz = await QuizAssignment.findOne({
      _id: req.params.id,
      teacher: req.teacher._id,
      isDeleted: false,
    });

    if (!existingQuiz) {
      return res.status(404).json({ message: "Quiz assignment not found" });
    }

    const nextCourseId = req.body.course || existingQuiz.course;
    const nextBatchId = req.body.batch || existingQuiz.batch;
    const nextAssignToAllStudents =
      typeof req.body.assignToAllStudents === "boolean"
        ? req.body.assignToAllStudents
        : existingQuiz.assignToAllStudents;
    const nextStudentIds = req.body.studentIds || existingQuiz.students;
    const nextQuestionIds = req.body.questionIds || existingQuiz.questions;

    const course = await Course.findOne({
      _id: nextCourseId,
      teacher: req.teacher._id,
      isDeleted: false,
    });

    if (!course) {
      return res.status(404).json({ message: "Course not found" });
    }

    const batch = await Batch.findOne({
      _id: nextBatchId,
      teacher: req.teacher._id,
      isDeleted: false,
    });

    if (!batch) {
      return res.status(404).json({ message: "Batch not found" });
    }

    const batchHasCourse = batch.courses.some((courseRef) => String(courseRef) === String(nextCourseId));
    if (!batchHasCourse) {
      return res.status(400).json({
        message: "Selected batch is not aligned with the selected course",
      });
    }

    const students = await getValidatedStudents({
      teacherId: req.teacher._id,
      batch,
      studentIds: nextStudentIds,
      assignToAllStudents: nextAssignToAllStudents,
    });

    const questions = await validateQuestionIds({
      teacherId: req.teacher._id,
      questionIds: nextQuestionIds,
    });

    const computedTotalMarks = questions.reduce((sum, question) => sum + question.marks, 0);

    const quizAssignment = await QuizAssignment.findOneAndUpdate(
      {
        _id: req.params.id,
        teacher: req.teacher._id,
        isDeleted: false,
      },
      {
        ...req.body,
        students,
        questions: questions.map((question) => question._id),
        totalMarks: req.body.totalMarks || computedTotalMarks,
      },
      { returnDocument: "after", runValidators: true }
    )
      .populate("course")
      .populate("batch")
      .populate("students", "-password")
      .populate({
        path: "questions",
        populate: { path: "skill" },
      });

    return res.status(200).json({
      message: "Quiz assignment updated successfully",
      quizAssignment,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

exports.softDeleteQuizAssignment = async (req, res) => {
  try {
    const quizAssignment = await QuizAssignment.findOneAndUpdate(
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
      { returnDocument: "after" }
    );

    if (!quizAssignment) {
      return res.status(404).json({ message: "Quiz assignment not found" });
    }

    return res.status(200).json({ message: "Quiz assignment deleted successfully" });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

exports.hardDeleteQuizAssignment = async (req, res) => {
  try {
    const quizAssignment = await QuizAssignment.findOneAndDelete({
      _id: req.params.id,
      teacher: req.teacher._id,
    });

    if (!quizAssignment) {
      return res.status(404).json({ message: "Quiz assignment not found" });
    }

    return res.status(200).json({ message: "Quiz assignment permanently deleted successfully" });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};
