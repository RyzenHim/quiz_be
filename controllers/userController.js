const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const Batch = require("../models/batchModel");
const PracticeAttempt = require("../models/practiceAttemptModel");
const Question = require("../models/questionModel");
const QuizAssignment = require("../models/quizAssignmentModel");
const QuizAttempt = require("../models/quizAttemptModel");
const User = require("../models/userModel");
const { sendStudentWelcomeMail } = require("../utils/mailService");

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

const normalizeAnswerText = (value = "") =>
  String(value)
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();

const shuffleItems = (items = []) => {
  const shuffled = [...items];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[randomIndex]] = [shuffled[randomIndex], shuffled[index]];
  }

  return shuffled;
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

const evaluateStudentAnswer = (question, submittedAnswer = {}) => {
  if (question.type === "short_answer") {
    const expected = normalizeAnswerText(question.correctAnswerText);
    const actual = normalizeAnswerText(submittedAnswer.answerText);
    return Boolean(expected) && expected === actual;
  }

  const correctOptionIds = (question.options || [])
    .filter((option) => option.isCorrect)
    .map((option) => String(option._id))
    .sort();

  const selectedOptionIds = (submittedAnswer.selectedOptionIds || [])
    .map((optionId) => String(optionId))
    .sort();

  return (
    correctOptionIds.length === selectedOptionIds.length &&
    correctOptionIds.every((optionId, index) => optionId === selectedOptionIds[index])
  );
};

const buildCorrectAnswerPayload = (question) => {
  if (question.type === "short_answer") {
    return {
      correctAnswerText: question.correctAnswerText || "No correct answer available.",
      correctOptionIds: [],
    };
  }

  const correctOptions = (question.options || []).filter((option) => option.isCorrect);

  return {
    correctAnswerText:
      correctOptions.map((option) => option.text).join(", ") || "No correct answer available.",
    correctOptionIds: correctOptions.map((option) => String(option._id)),
  };
};

const buildPracticeSummary = ({ course, skill, topic }) => {
  if (topic && skill) {
    return `Practice questions will be randomly selected only from the ${topic.title} topic in ${skill.name} for the ${course.title} course.`;
  }

  if (skill) {
    return `Practice questions will be randomly selected from any topic inside the ${skill.name} skill for the ${course.title} course.`;
  }

  return `Practice questions will be randomly selected from any aligned skill and any aligned topic inside the ${course.title} course.`;
};

const resolvePracticeScope = (alignedCourses, { courseId, skillId, topicId }) => {
  if (!courseId) {
    return { status: 400, message: "courseId is required" };
  }

  const course = alignedCourses.find((item) => String(item._id) === String(courseId));

  if (!course) {
    return { status: 403, message: "Selected course is not available for this batch" };
  }

  const courseSkills = course.skills || [];
  const selectedSkill = skillId
    ? courseSkills.find((item) => String(item._id) === String(skillId))
    : null;

  if (skillId && !selectedSkill) {
    return { status: 403, message: "Selected skill is not available for this course" };
  }

  const filteredSkills = selectedSkill ? [selectedSkill] : courseSkills;
  const availableTopics = filteredSkills.flatMap((skill) =>
    (skill.topics || []).map((topic) => ({
      ...topic,
      skillId: skill._id,
      skillName: skill.name,
    }))
  );

  const selectedTopic = topicId
    ? availableTopics.find((item) => String(item._id) === String(topicId))
    : null;

  if (topicId && !selectedTopic) {
    return { status: 403, message: "Selected topic is not available for this selection" };
  }

  const topicIds = selectedTopic
    ? [selectedTopic._id]
    : availableTopics.map((topic) => topic._id);

  const skillIds = selectedSkill
    ? [selectedSkill._id]
    : filteredSkills.map((skill) => skill._id);

  return {
    course,
    skill: selectedSkill,
    topic: selectedTopic,
    skillIds,
    topicIds,
    summary: buildPracticeSummary({
      course,
      skill: selectedSkill,
      topic: selectedTopic,
    }),
  };
};

const loadStudentAlignedContext = async (studentId) => {
  const student = await User.findOne({
    _id: studentId,
    role: "student",
    isDeleted: false,
  }).populate({
    path: "batch",
    populate: {
      path: "courses",
      match: {
        isDeleted: false,
        isActive: true,
      },
      populate: {
        path: "skills",
        match: {
          isDeleted: false,
          isActive: true,
        },
      },
    },
  });

  if (!student?.batch) {
    return null;
  }

  const alignedCourses = (student.batch.courses || []).map((course) => ({
    _id: course._id,
    title: course.title,
    description: course.description,
    category: course.category,
    level: course.level,
    code: course.code,
    status: course.status,
    skills: (course.skills || []).map((skill) => ({
      _id: skill._id,
      name: skill.name,
      description: skill.description,
      topics: (skill.topics || [])
        .filter((topic) => topic.isActive !== false)
        .map((topic) => ({
          _id: topic._id,
          title: topic.title,
          description: topic.description,
          isActive: topic.isActive !== false,
        })),
    })),
  }));

  return {
    student,
    alignedCourses,
  };
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

    const studentMailSent = await sendStudentWelcomeMail({
      student: populatedStudent,
      plainPassword: password,
    }).catch((error) => {
      console.error("Student welcome mail failed:", error.message);
      return false;
    });

    return res.status(201).json({
      message: studentMailSent
        ? "Student created successfully and welcome mail sent"
        : "Student created successfully, but welcome mail was not sent",
      mailSent: studentMailSent,
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
    const context = await loadStudentAlignedContext(req.student._id);

    if (!context?.student) {
      return res.status(404).json({ message: "Student not found" });
    }

    const { student, alignedCourses } = context;

    if (!student.batch) {
      return res.status(200).json({
        student: sanitizeStudent(student),
        dashboard: {
          batch: null,
          alignedCourses: [],
          assignedQuizCount: 0,
          upcomingQuizCount: 0,
          recentQuizzes: [],
        },
      });
    }

    const [quizzes, practiceAttempts] = await Promise.all([
      QuizAssignment.find({
        students: student._id,
        isActive: true,
        status: { $in: ["scheduled", "published", "completed"] },
      })
        .populate("course")
        .populate("batch")
        .sort({ startAt: 1, createdAt: -1 }),
      PracticeAttempt.find({ student: student._id })
        .populate("course", "title")
        .populate("skill", "name")
        .sort({ createdAt: -1 })
        .limit(5),
    ]);

    const now = new Date();
    const upcomingQuizzes = quizzes.filter((quiz) => !quiz.startAt || quiz.startAt >= now);
    const correctPracticeCount = practiceAttempts.filter((attempt) => attempt.isCorrect).length;

    return res.status(200).json({
      student: sanitizeStudent(student),
      dashboard: {
        batch: student.batch,
        alignedCourses,
        assignedQuizCount: quizzes.length,
        upcomingQuizCount: upcomingQuizzes.length,
        recentQuizzes: quizzes.slice(0, 5),
        practiceAttemptCount: practiceAttempts.length,
        practiceCorrectCount: correctPracticeCount,
        recentPractice: practiceAttempts,
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
    const context = await loadStudentAlignedContext(req.student._id);

    if (!context?.student?.batch) {
      return res.status(404).json({ message: "Batch not found for this student" });
    }

    const { student, alignedCourses } = context;

    return res.status(200).json({
      batch: student.batch,
      alignedCourses,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

exports.getPracticeQuestions = async (req, res) => {
  try {
    const { courseId, skillId, topicId } = req.query;

    const context = await loadStudentAlignedContext(req.student._id);

    if (!context?.student?.batch) {
      return res.status(404).json({ message: "Batch not found for this student" });
    }

    const scope = resolvePracticeScope(context.alignedCourses, {
      courseId,
      skillId,
      topicId,
    });

    if (scope.message) {
      return res.status(scope.status).json({ message: scope.message });
    }

    const filter = {
      teacher: context.student.teacher,
      skill: { $in: scope.skillIds },
      topicId: { $in: scope.topicIds },
      isDeleted: false,
      isActive: true,
    };

    const questions = shuffleItems(await Question.find(filter).populate("skill"));

    return res.status(200).json({
      questions: questions.map((question) => sanitizeQuestionForStudent(question)),
      scope: {
        course: scope.course,
        skill: scope.skill,
        topic: scope.topic,
        summary: scope.summary,
      },
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

exports.evaluatePracticeQuestion = async (req, res) => {
  try {
    const { courseId, skillId, topicId, questionId, selectedOptionIds = [], answerText = "" } =
      req.body;

    if (!courseId || !questionId) {
      return res.status(400).json({ message: "courseId and questionId are required" });
    }

    const context = await loadStudentAlignedContext(req.student._id);

    if (!context?.student?.batch) {
      return res.status(404).json({ message: "Batch not found for this student" });
    }

    const scope = resolvePracticeScope(context.alignedCourses, {
      courseId,
      skillId,
      topicId,
    });

    if (scope.message) {
      return res.status(scope.status).json({ message: scope.message });
    }

    const question = await Question.findOne({
      _id: questionId,
      teacher: context.student.teacher,
      skill: { $in: scope.skillIds },
      topicId: { $in: scope.topicIds },
      isDeleted: false,
      isActive: true,
    }).populate("skill");

    if (!question) {
      return res.status(404).json({ message: "Question not found for this practice selection" });
    }

    const isCorrect = evaluateStudentAnswer(question, {
      selectedOptionIds,
      answerText,
    });

    const correctAnswer = buildCorrectAnswerPayload(question);

    await PracticeAttempt.create({
      teacher: context.student.teacher,
      student: req.student._id,
      course: scope.course._id,
      skill: scope.skill?._id || question.skill?._id || null,
      topicId: scope.topic?._id || question.topicId || null,
      topicTitle: question.topicTitle || scope.topic?.title || "",
      question: question._id,
      questionText: question.questionText,
      selectedOptionIds,
      answerText,
      isCorrect,
      explanation: question.explanation || "",
      submittedAt: new Date(),
    });

    return res.status(200).json({
      questionId: question._id,
      isCorrect,
      explanation: question.explanation || "",
      ...correctAnswer,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

exports.getPracticeHistory = async (req, res) => {
  try {
    const attempts = await PracticeAttempt.find({ student: req.student._id })
      .populate("course", "title")
      .populate("skill", "name")
      .sort({ createdAt: -1 })
      .limit(100);

    const totalAttempts = attempts.length;
    const correctAttempts = attempts.filter((attempt) => attempt.isCorrect).length;
    const accuracy =
      totalAttempts > 0 ? Number(((correctAttempts / totalAttempts) * 100).toFixed(2)) : 0;

    const topicPerformance = Array.from(
      attempts.reduce((accumulator, attempt) => {
        const key = attempt.topicTitle || "Unspecified topic";
        const entry = accumulator.get(key) || {
          topicTitle: key,
          attempts: 0,
          correct: 0,
        };
        entry.attempts += 1;
        if (attempt.isCorrect) {
          entry.correct += 1;
        }
        accumulator.set(key, entry);
        return accumulator;
      }, new Map()).values()
    )
      .map((entry) => ({
        ...entry,
        accuracy: entry.attempts > 0 ? Number(((entry.correct / entry.attempts) * 100).toFixed(2)) : 0,
      }))
      .sort((a, b) => b.attempts - a.attempts)
      .slice(0, 8);

    return res.status(200).json({
      attempts,
      summary: {
        totalAttempts,
        correctAttempts,
        incorrectAttempts: totalAttempts - correctAttempts,
        accuracy,
        topicPerformance,
      },
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

exports.getStudentResultOverview = async (req, res) => {
  try {
    const attempts = await QuizAttempt.find({ student: req.student._id })
      .populate({
        path: "quizAssignment",
        populate: [
          { path: "course", select: "title" },
          { path: "batch", select: "batchName" },
        ],
      })
      .sort({ createdAt: -1 });

    const totalAttempts = attempts.length;
    const passedAttempts = attempts.filter((attempt) => attempt.isPassed).length;
    const averagePercentage =
      totalAttempts > 0
        ? Number(
            (
              attempts.reduce((sum, attempt) => sum + (attempt.percentage || 0), 0) / totalAttempts
            ).toFixed(2)
          )
        : 0;

    return res.status(200).json({
      attempts,
      summary: {
        totalAttempts,
        passedAttempts,
        failedAttempts: totalAttempts - passedAttempts,
        averagePercentage,
      },
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};
