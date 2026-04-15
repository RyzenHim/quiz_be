const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const Batch = require("../models/batchModel");
const Question = require("../models/questionModel");
const QuizAssignment = require("../models/quizAssignmentModel");
const User = require("../models/userModel");

const sanitizeStudent = (student) => {
  const studentObject = student.toObject();
  delete studentObject.password;
  return studentObject;
};

const buildStudentSort = (sortBy = "createdAt", sortOrder = "desc") => {
  const direction = sortOrder === "asc" ? 1 : -1;
  const allowedSortFields = {
    createdAt: "createdAt",
    name: "name",
    enrollmentNumber: "enrollmentNumber",
    email: "email",
  };

  return { [allowedSortFields[sortBy] || "createdAt"]: direction };
};

const sanitizeQuestionForStudent = (question) => {
  const questionObject = question.toObject();
  questionObject.options = (questionObject.options || []).map((option) => ({
    _id: option._id,
    text: option.text,
  }));
  delete questionObject.correctAnswerText;
  return questionObject;
};

const signStudentToken = (student) =>
  jwt.sign(
    {
      studentId: student._id,
      email: student.email,
      role: "student",
    },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );

exports.adduser = async (req, res) => {
  try {
    const {
      name,
      email,
      password,
      batch: batchId,
      enrollmentNumber,
      phone,
      guardianName,
      guardianPhone,
      address,
      dateOfBirth,
    } = req.body;

    if (!name || !email || !batchId || !enrollmentNumber) {
      return res.status(400).json({
        message: "name, email, batch and enrollmentNumber are required",
      });
    }

    const batch = await Batch.findOne({
      _id: batchId,
      teacher: req.teacher._id,
      isDeleted: false,
    });

    if (!batch) {
      return res.status(404).json({ message: "Batch not found for this teacher" });
    }

    const existingStudent = await User.findOne({
      $or: [{ email: email.toLowerCase() }, { enrollmentNumber, teacher: req.teacher._id }],
    });

    if (existingStudent) {
      return res.status(400).json({
        message: "Student already exists with this email or enrollment number",
      });
    }

    const hashedPassword = password ? await bcrypt.hash(password, 10) : undefined;

    const student = await User.create({
      name,
      email,
      password: hashedPassword,
      role: "student",
      teacher: req.teacher._id,
      batch: batchId,
      enrollmentNumber,
      phone,
      guardianName,
      guardianPhone,
      address,
      dateOfBirth,
    });

    await Batch.findByIdAndUpdate(batchId, {
      $addToSet: { students: student._id },
    });

    const populatedStudent = await User.findById(student._id)
      .populate("teacher", "-password")
      .populate("batch");

    return res.status(201).json({
      message: "Student created successfully",
      student: sanitizeStudent(populatedStudent),
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

exports.alluser = async (req, res) => {
  try {
    const {
      search = "",
      sortBy = "createdAt",
      sortOrder = "desc",
      page = 1,
      limit = 10,
      batchId,
      courseId,
    } = req.query;

    const normalizedPage = Math.max(Number(page) || 1, 1);
    const normalizedLimit = Math.min(Math.max(Number(limit) || 10, 1), 100);

    const filter = {
      teacher: req.teacher._id,
      role: "student",
      isDeleted: req.query.deleted === "true",
    };

    if (batchId) {
      filter.batch = batchId;
    }

    if (courseId && !batchId) {
      const alignedBatches = await Batch.find({
        teacher: req.teacher._id,
        isDeleted: false,
        courses: courseId,
      }).select("_id");

      filter.batch = { $in: alignedBatches.map((batch) => batch._id) };
    }

    if (search.trim()) {
      const searchRegex = new RegExp(search.trim(), "i");
      filter.$or = [
        { name: searchRegex },
        { email: searchRegex },
        { enrollmentNumber: searchRegex },
        { phone: searchRegex },
      ];
    }

    const totalItems = await User.countDocuments(filter);

    const students = await User.find(filter)
      .populate("batch")
      .sort(buildStudentSort(sortBy, sortOrder))
      .skip((normalizedPage - 1) * normalizedLimit)
      .limit(normalizedLimit);

    return res.status(200).json({
      students: students.map((student) => sanitizeStudent(student)),
      pagination: {
        page: normalizedPage,
        limit: normalizedLimit,
        totalItems,
        totalPages: Math.max(Math.ceil(totalItems / normalizedLimit), 1),
      },
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

exports.oneuser = async (req, res) => {
  try {
    const student = await User.findOne({
      _id: req.params.id,
      teacher: req.teacher._id,
      role: "student",
      isDeleted: false,
    }).populate("batch");

    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }

    return res.status(200).json({ student: sanitizeStudent(student) });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

exports.updateUser = async (req, res) => {
  try {
    const { batch: batchId } = req.body;
    const existingStudent = await User.findOne({
      _id: req.params.id,
      teacher: req.teacher._id,
      role: "student",
      isDeleted: false,
    });

    if (!existingStudent) {
      return res.status(404).json({ message: "Student not found" });
    }

    if (batchId && String(batchId) !== String(existingStudent.batch)) {
      const newBatch = await Batch.findOne({
        _id: batchId,
        teacher: req.teacher._id,
        isDeleted: false,
      });

      if (!newBatch) {
        return res.status(404).json({ message: "New batch not found" });
      }

      await Batch.findByIdAndUpdate(existingStudent.batch, {
        $pull: { students: existingStudent._id },
      });

      await Batch.findByIdAndUpdate(batchId, {
        $addToSet: { students: existingStudent._id },
      });
    }

    if (req.body.password) {
      req.body.password = await bcrypt.hash(req.body.password, 10);
    }

    const updatedStudent = await User.findByIdAndUpdate(req.params.id, req.body, {
      returnDocument: "after",
      runValidators: true,
    }).populate("batch");

    return res.status(200).json({
      message: "Student updated successfully",
      student: sanitizeStudent(updatedStudent),
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

exports.softDeleteUser = async (req, res) => {
  try {
    const student = await User.findOneAndUpdate(
      {
        _id: req.params.id,
        teacher: req.teacher._id,
        role: "student",
        isDeleted: false,
      },
      {
        isDeleted: true,
        isActive: false,
        deletedAt: new Date(),
      },
      { returnDocument: "after" }
    );

    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }

    await Batch.findByIdAndUpdate(student.batch, {
      $pull: { students: student._id },
    });

    return res.status(200).json({ message: "Student soft deleted successfully" });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

exports.restoreUser = async (req, res) => {
  try {
    const student = await User.findOneAndUpdate(
      {
        _id: req.params.id,
        teacher: req.teacher._id,
        role: "student",
        isDeleted: true,
      },
      {
        isDeleted: false,
        isActive: true,
        deletedAt: null,
      },
      { returnDocument: "after" }
    ).populate("batch");

    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }

    await Batch.findByIdAndUpdate(student.batch?._id || student.batch, {
      $addToSet: { students: student._id },
    });

    return res.status(200).json({
      message: "Student restored successfully",
      student: sanitizeStudent(student),
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

exports.hardDeleteUser = async (req, res) => {
  try {
    const student = await User.findOneAndDelete({
      _id: req.params.id,
      teacher: req.teacher._id,
      role: "student",
    });

    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }

    await Batch.findByIdAndUpdate(student.batch, {
      $pull: { students: student._id },
    });

    return res.status(200).json({ message: "Student permanently deleted successfully" });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

exports.loginStudent = async (req, res) => {
  try {
    const { emailOrEnrollmentNumber, password } = req.body;

    if (!emailOrEnrollmentNumber || !password) {
      return res.status(400).json({
        message: "emailOrEnrollmentNumber and password are required",
      });
    }

    const student = await User.findOne({
      $or: [
        { email: String(emailOrEnrollmentNumber).toLowerCase() },
        { enrollmentNumber: emailOrEnrollmentNumber },
      ],
      role: "student",
      isDeleted: false,
    }).populate("batch");

    if (!student || !student.password) {
      return res.status(404).json({ message: "Student not found" });
    }

    const isPasswordMatched = await bcrypt.compare(password, student.password);
    if (!isPasswordMatched) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const token = signStudentToken(student);

    return res.status(200).json({
      message: "Student logged in successfully",
      token,
      student: sanitizeStudent(student),
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

exports.getStudentProfile = async (req, res) => {
  return res.status(200).json({ student: sanitizeStudent(req.student) });
};

exports.getAssignedQuizzes = async (req, res) => {
  try {
    const quizzes = await QuizAssignment.find({
      students: req.student._id,
      isActive: true,
      status: { $in: ["scheduled", "published", "completed"] },
    })
      .populate("course")
      .populate("batch")
      .sort({ createdAt: -1 });

    return res.status(200).json({ quizzes });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

exports.getStudentDashboard = async (req, res) => {
  try {
    const student = await User.findOne({
      _id: req.student._id,
      role: "student",
      isDeleted: false,
      isActive: true,
    }).populate({
      path: "batch",
      populate: {
        path: "courses",
        populate: {
          path: "skills",
        },
      },
    });

    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }

    const quizzes = await QuizAssignment.find({
      students: student._id,
      isActive: true,
      status: { $in: ["scheduled", "published", "completed"] },
    })
      .populate("course")
      .populate("batch")
      .sort({ startAt: 1, createdAt: -1 });

    const now = new Date();
    const upcomingQuizzes = quizzes.filter((quiz) => !quiz.startAt || quiz.startAt >= now);
    const courses = student.batch?.courses || [];

    return res.status(200).json({
      student: sanitizeStudent(student),
      dashboard: {
        batch: student.batch,
        alignedCourses: courses,
        assignedQuizCount: quizzes.length,
        upcomingQuizCount: upcomingQuizzes.length,
        recentQuizzes: quizzes.slice(0, 5),
      },
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

exports.getUpcomingQuizzes = async (req, res) => {
  try {
    const now = new Date();

    const quizzes = await QuizAssignment.find({
      students: req.student._id,
      isActive: true,
      status: { $in: ["scheduled", "published"] },
      $or: [{ startAt: { $exists: false } }, { startAt: null }, { startAt: { $gte: now } }],
    })
      .populate("course")
      .populate("batch")
      .sort({ startAt: 1, createdAt: -1 });

    return res.status(200).json({ quizzes });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

exports.updateStudentProfile = async (req, res) => {
  try {
    const allowedFields = ["name", "phone", "guardianName", "guardianPhone", "address", "dateOfBirth"];
    const payload = {};

    for (const field of allowedFields) {
      if (typeof req.body[field] !== "undefined") {
        payload[field] = req.body[field];
      }
    }

    const student = await User.findOneAndUpdate(
      {
        _id: req.student._id,
        role: "student",
        isDeleted: false,
      },
      payload,
      { returnDocument: "after", runValidators: true }
    ).populate("batch");

    return res.status(200).json({
      message: "Profile updated successfully",
      student: sanitizeStudent(student),
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

exports.changeStudentPassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        message: "currentPassword and newPassword are required",
      });
    }

    if (String(newPassword).length < 6) {
      return res.status(400).json({
        message: "New password must be at least 6 characters long",
      });
    }

    const student = await User.findOne({
      _id: req.student._id,
      role: "student",
      isDeleted: false,
    });

    if (!student || !student.password) {
      return res.status(404).json({ message: "Student not found" });
    }

    const isMatched = await bcrypt.compare(currentPassword, student.password);
    if (!isMatched) {
      return res.status(401).json({ message: "Current password is incorrect" });
    }

    student.password = await bcrypt.hash(newPassword, 10);
    await student.save();

    return res.status(200).json({ message: "Password updated successfully" });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

exports.getPracticeTopics = async (req, res) => {
  try {
    const student = await User.findOne({
      _id: req.student._id,
      role: "student",
      isDeleted: false,
    }).populate({
      path: "batch",
      populate: {
        path: "courses",
        populate: {
          path: "skills",
        },
      },
    });

    if (!student?.batch) {
      return res.status(404).json({ message: "Batch not found for this student" });
    }

    const courses = student.batch.courses || [];
    const skills = courses.flatMap((course) => course.skills || []);
    const uniqueSkills = Array.from(
      new Map(skills.map((skill) => [String(skill._id), skill])).values()
    );

    const topics = uniqueSkills.flatMap((skill) =>
      (skill.topics || []).map((topic) => ({
        _id: topic._id,
        title: topic.title,
        description: topic.description,
        skill: {
          _id: skill._id,
          name: skill.name,
        },
      }))
    );

    return res.status(200).json({
      batch: student.batch,
      courses,
      topics,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

exports.getPracticeQuestions = async (req, res) => {
  try {
    const { topicId, skillId } = req.query;

    if (!topicId) {
      return res.status(400).json({ message: "topicId is required" });
    }

    const student = await User.findOne({
      _id: req.student._id,
      role: "student",
      isDeleted: false,
    }).populate({
      path: "batch",
      populate: {
        path: "courses",
        populate: {
          path: "skills",
        },
      },
    });

    if (!student?.batch) {
      return res.status(404).json({ message: "Batch not found for this student" });
    }

    const alignedSkills = Array.from(
      new Map(
        (student.batch.courses || [])
          .flatMap((course) => course.skills || [])
          .map((skill) => [String(skill._id), skill])
      ).values()
    );

    const alignedSkillIds = alignedSkills.map((skill) => skill._id);

    if (skillId && !alignedSkillIds.some((id) => String(id) === String(skillId))) {
      return res.status(403).json({ message: "Selected skill is not available for this batch" });
    }

    const filter = {
      teacher: req.student.teacher,
      skill: skillId || { $in: alignedSkillIds },
      topicId,
      isDeleted: false,
      isActive: true,
    };

    const questions = await Question.find(filter).populate("skill").sort({ createdAt: -1 });

    return res.status(200).json({
      questions: questions.map((question) => sanitizeQuestionForStudent(question)),
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};
