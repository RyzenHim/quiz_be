const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const Batch = require("../models/batchModel");
const Course = require("../models/courseModel");
const PracticeAttempt = require("../models/practiceAttemptModel");
const Question = require("../models/questionModel");
const QuizAssignment = require("../models/quizAssignmentModel");
const QuizAttempt = require("../models/quizAttemptModel");
const Skill = require("../models/skillModel");
const Teacher = require("../models/teacherModel");
const User = require("../models/userModel");

const signTeacherToken = (teacher) =>
  jwt.sign(
    {
      teacherId: teacher._id,
      email: teacher.email,
      role: "teacher",
    },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );

const sanitizeTeacher = (teacher) => {
  const teacherObject = teacher.toObject();
  delete teacherObject.password;
  return teacherObject;
};

exports.registerTeacher = async (req, res) => {
  try {
    const { name, email, password, phone, specialization } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: "name, email and password are required" });
    }

    const existingTeacher = await Teacher.findOne({ email: email.toLowerCase() });
    if (existingTeacher) {
      return res.status(400).json({ message: "Teacher already exists with this email" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const teacher = await Teacher.create({
      name,
      email,
      password: hashedPassword,
      phone,
      specialization,
    });

    return res.status(201).json({
      message: "Teacher created successfully",
      teacher: sanitizeTeacher(teacher),
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

exports.loginTeacher = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "email and password are required" });
    }

    const teacher = await Teacher.findOne({
      email: email.toLowerCase(),
      isDeleted: false,
    });

    if (!teacher) {
      return res.status(404).json({ message: "Teacher not found" });
    }

    const passwordMatched = await bcrypt.compare(password, teacher.password);
    if (!passwordMatched) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    teacher.lastLoginAt = new Date();
    await teacher.save();

    const token = signTeacherToken(teacher);

    return res.status(200).json({
      message: "Teacher logged in successfully",
      token,
      teacher: sanitizeTeacher(teacher),
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

exports.getTeacherProfile = async (req, res) => {
  return res.status(200).json({ teacher: sanitizeTeacher(req.teacher) });
};

exports.updateTeacherProfile = async (req, res) => {
  try {
    const allowedFields = ["name", "phone", "specialization"];
    const payload = {};

    for (const field of allowedFields) {
      if (typeof req.body[field] !== "undefined") {
        payload[field] = req.body[field];
      }
    }

    const teacher = await Teacher.findOneAndUpdate(
      {
        _id: req.teacher._id,
        isDeleted: false,
        isActive: true,
      },
      payload,
      { returnDocument: "after", runValidators: true }
    );

    return res.status(200).json({
      message: "Profile updated successfully",
      teacher: sanitizeTeacher(teacher),
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

exports.changeTeacherPassword = async (req, res) => {
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

    const teacher = await Teacher.findOne({
      _id: req.teacher._id,
      isDeleted: false,
      isActive: true,
    });

    if (!teacher) {
      return res.status(404).json({ message: "Teacher not found" });
    }

    const passwordMatched = await bcrypt.compare(currentPassword, teacher.password);
    if (!passwordMatched) {
      return res.status(401).json({ message: "Current password is incorrect" });
    }

    teacher.password = await bcrypt.hash(newPassword, 10);
    await teacher.save();

    return res.status(200).json({ message: "Password updated successfully" });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

exports.getTeachers = async (req, res) => {
  try {
    const teachers = await Teacher.find({ isDeleted: false }).select("-password");
    return res.status(200).json({ teachers });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

exports.getTeacherAnalytics = async (req, res) => {
  try {
    const teacherId = req.teacher._id;

    const [
      students,
      courses,
      batches,
      skills,
      questions,
      quizAssignments,
      quizAttempts,
      practiceAttempts,
    ] = await Promise.all([
      User.find({ teacher: teacherId, role: "student", isDeleted: false }).select("name email"),
      Course.find({ teacher: teacherId, isDeleted: false }).select("title"),
      Batch.find({ teacher: teacherId, isDeleted: false }).select("batchName"),
      Skill.find({ teacher: teacherId, isDeleted: false }).select("name topics"),
      Question.find({ teacher: teacherId, isDeleted: false })
        .select("questionText topicTitle skill marks")
        .populate("skill", "name"),
      QuizAssignment.find({ teacher: teacherId, isDeleted: false })
        .select("title course batch questions students status createdAt")
        .populate("course", "title")
        .populate("batch", "batchName"),
      QuizAttempt.find({ teacher: teacherId })
        .select("score totalMarks percentage isPassed quizAssignment student createdAt")
        .populate("student", "name email")
        .populate("quizAssignment", "title questions"),
      PracticeAttempt.find({ teacher: teacherId })
        .select("isCorrect topicTitle skill createdAt")
        .populate("skill", "name"),
    ]);

    const overallQuizAverage =
      quizAttempts.length > 0
        ? Number(
            (
              quizAttempts.reduce((sum, attempt) => sum + (attempt.percentage || 0), 0) /
              quizAttempts.length
            ).toFixed(2)
          )
        : 0;

    const passRate =
      quizAttempts.length > 0
        ? Number(
            (
              (quizAttempts.filter((attempt) => attempt.isPassed).length / quizAttempts.length) *
              100
            ).toFixed(2)
          )
        : 0;

    const quizPerformance = quizAssignments
      .map((quiz) => {
        const attemptsForQuiz = quizAttempts.filter(
          (attempt) => String(attempt.quizAssignment?._id || attempt.quizAssignment) === String(quiz._id)
        );
        const averagePercentage =
          attemptsForQuiz.length > 0
            ? Number(
                (
                  attemptsForQuiz.reduce((sum, attempt) => sum + (attempt.percentage || 0), 0) /
                  attemptsForQuiz.length
                ).toFixed(2)
              )
            : 0;

        return {
          quizAssignmentId: quiz._id,
          title: quiz.title,
          courseTitle: quiz.course?.title || "No course",
          batchName: quiz.batch?.batchName || "No batch",
          assignedStudents: (quiz.students || []).length,
          attempts: attemptsForQuiz.length,
          averagePercentage,
          passRate:
            attemptsForQuiz.length > 0
              ? Number(
                  (
                    (attemptsForQuiz.filter((attempt) => attempt.isPassed).length /
                      attemptsForQuiz.length) *
                    100
                  ).toFixed(2)
                )
              : 0,
        };
      })
      .sort((a, b) => b.attempts - a.attempts || b.averagePercentage - a.averagePercentage)
      .slice(0, 8);

    const topicPerformance = Array.from(
      questions.reduce((accumulator, question) => {
        const key = question.topicTitle || "Unspecified topic";
        const relatedAttempts = quizAttempts.filter((attempt) =>
          (attempt.quizAssignment?.questions || []).some(
            (questionId) => String(questionId) === String(question._id)
          )
        );
        const existing = accumulator.get(key) || {
          topicTitle: key,
          questionCount: 0,
          totalMarks: 0,
          attempts: 0,
          averagePercentage: 0,
        };
        existing.questionCount += 1;
        existing.totalMarks += question.marks || 0;
        if (relatedAttempts.length > 0) {
          existing.attempts += relatedAttempts.length;
          existing.averagePercentage +=
            relatedAttempts.reduce((sum, attempt) => sum + (attempt.percentage || 0), 0) /
            relatedAttempts.length;
        }
        accumulator.set(key, existing);
        return accumulator;
      }, new Map()).values()
    )
      .map((entry) => ({
        ...entry,
        averagePercentage:
          entry.questionCount > 0 ? Number((entry.averagePercentage / entry.questionCount).toFixed(2)) : 0,
      }))
      .sort((a, b) => a.averagePercentage - b.averagePercentage)
      .slice(0, 8);

    const practiceSummary = {
      totalAttempts: practiceAttempts.length,
      accuracy:
        practiceAttempts.length > 0
          ? Number(
              (
                (practiceAttempts.filter((attempt) => attempt.isCorrect).length / practiceAttempts.length) *
                100
              ).toFixed(2)
            )
          : 0,
      topTopics: Array.from(
        practiceAttempts.reduce((accumulator, attempt) => {
          const key = attempt.topicTitle || "Unspecified topic";
          const entry = accumulator.get(key) || { topicTitle: key, attempts: 0, correct: 0 };
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
        .slice(0, 6),
    };

    return res.status(200).json({
      summary: {
        students: students.length,
        courses: courses.length,
        batches: batches.length,
        skills: skills.length,
        questions: questions.length,
        quizzes: quizAssignments.length,
        quizAttempts: quizAttempts.length,
        overallQuizAverage,
        passRate,
      },
      quizPerformance,
      topicPerformance,
      recentAttempts: quizAttempts.slice(0, 8),
      practiceSummary,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};
