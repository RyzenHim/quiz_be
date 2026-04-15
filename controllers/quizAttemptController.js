const QuizAssignment = require("../models/quizAssignmentModel");
const QuizAttempt = require("../models/quizAttemptModel");
const Question = require("../models/questionModel");

const sanitizeQuestionForStudent = (question) => {
  const questionObject = question.toObject();
  questionObject.options = (questionObject.options || []).map((option) => ({
    _id: option._id,
    text: option.text,
  }));
  delete questionObject.correctAnswerText;
  return questionObject;
};

const evaluateAnswer = (question, submittedAnswer) => {
  if (!submittedAnswer) {
    return { isCorrect: false, obtainedMarks: 0 };
  }

  if (question.type === "short_answer") {
    const expected = (question.correctAnswerText || "").trim().toLowerCase();
    const actual = (submittedAnswer.answerText || "").trim().toLowerCase();
    const isCorrect = Boolean(expected) && expected === actual;
    return {
      isCorrect,
      obtainedMarks: isCorrect ? question.marks : 0,
    };
  }

  const correctOptionIds = (question.options || [])
    .filter((option) => option.isCorrect)
    .map((option) => String(option._id))
    .sort();

  const selectedOptionIds = (submittedAnswer.selectedOptionIds || [])
    .map((optionId) => String(optionId))
    .sort();

  const isCorrect =
    correctOptionIds.length === selectedOptionIds.length &&
    correctOptionIds.every((optionId, index) => optionId === selectedOptionIds[index]);

  return {
    isCorrect,
    obtainedMarks: isCorrect ? question.marks : 0,
  };
};

exports.submitQuizAttempt = async (req, res) => {
  try {
    const { quizAssignmentId, answers = [] } = req.body;

    if (!quizAssignmentId || !Array.isArray(answers)) {
      return res.status(400).json({ message: "quizAssignmentId and answers are required" });
    }

    const quizAssignment = await QuizAssignment.findOne({
      _id: quizAssignmentId,
      isActive: true,
    }).populate("questions");

    if (!quizAssignment) {
      return res.status(404).json({ message: "Quiz assignment not found" });
    }

    const studentAssigned = quizAssignment.students.some(
      (studentId) => String(studentId) === String(req.student._id)
    );

    if (!studentAssigned) {
      return res.status(403).json({ message: "Quiz is not assigned to this student" });
    }

    const existingAttempt = await QuizAttempt.findOne({
      quizAssignment: quizAssignmentId,
      student: req.student._id,
    });

    if (existingAttempt) {
      return res.status(400).json({ message: "Quiz already submitted by this student" });
    }

    const questionMap = new Map(
      quizAssignment.questions.map((question) => [String(question._id), question])
    );

    let score = 0;
    const evaluatedAnswers = [];

    for (const question of quizAssignment.questions) {
      const submittedAnswer = answers.find(
        (answer) => String(answer.question) === String(question._id)
      );

      const evaluation = evaluateAnswer(question, submittedAnswer);
      score += evaluation.obtainedMarks;

      evaluatedAnswers.push({
        question: question._id,
        selectedOptionIds: submittedAnswer?.selectedOptionIds || [],
        answerText: submittedAnswer?.answerText,
        isCorrect: evaluation.isCorrect,
        obtainedMarks: evaluation.obtainedMarks,
      });
    }

    for (const answer of answers) {
      if (!questionMap.has(String(answer.question))) {
        return res.status(400).json({ message: "One or more submitted questions are invalid" });
      }
    }

    const totalMarks =
      quizAssignment.totalMarks ||
      quizAssignment.questions.reduce((sum, question) => sum + question.marks, 0);
    const percentage = totalMarks > 0 ? Number(((score / totalMarks) * 100).toFixed(2)) : 0;

    const attempt = await QuizAttempt.create({
      quizAssignment: quizAssignment._id,
      teacher: quizAssignment.teacher,
      student: req.student._id,
      answers: evaluatedAnswers,
      score,
      totalMarks,
      percentage,
      isPassed: score >= (quizAssignment.passMarks || 0),
      startedAt: req.body.startedAt || new Date(),
      submittedAt: new Date(),
      status: "evaluated",
    });

    const populatedAttempt = await QuizAttempt.findById(attempt._id)
      .populate("student", "-password")
      .populate("quizAssignment");

    return res.status(201).json({
      message: "Quiz submitted successfully",
      attempt: populatedAttempt,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

exports.getTeacherQuizAttempts = async (req, res) => {
  try {
    const filter = { teacher: req.teacher._id };

    if (req.query.quizAssignment) {
      filter.quizAssignment = req.query.quizAssignment;
    }

    if (req.query.student) {
      filter.student = req.query.student;
    }

    const attempts = await QuizAttempt.find(filter)
      .populate("student", "-password")
      .populate("quizAssignment")
      .sort({ createdAt: -1 });

    return res.status(200).json({ attempts });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

exports.getStudentQuizAttempts = async (req, res) => {
  try {
    const attempts = await QuizAttempt.find({ student: req.student._id })
      .populate("quizAssignment")
      .sort({ createdAt: -1 });

    return res.status(200).json({ attempts });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

exports.getStudentQuizAssignmentForAttempt = async (req, res) => {
  try {
    const quizAssignment = await QuizAssignment.findOne({
      _id: req.params.id,
      isActive: true,
    })
      .populate("course")
      .populate("batch")
      .populate("teacher", "name email")
      .populate("students", "name email enrollmentNumber")
      .populate("questions");

    if (!quizAssignment) {
      return res.status(404).json({ message: "Quiz assignment not found" });
    }

    const studentAssigned = quizAssignment.students.some(
      (studentId) => String(studentId) === String(req.student._id)
    );

    if (!studentAssigned) {
      return res.status(403).json({ message: "Quiz is not assigned to this student" });
    }

    const existingAttempt = await QuizAttempt.findOne({
      quizAssignment: quizAssignment._id,
      student: req.student._id,
    });

    const payload = quizAssignment.toObject();
    payload.questions = payload.questions.map((question) =>
      sanitizeQuestionForStudent({
        toObject: () => question,
      })
    );
    payload.alreadySubmitted = Boolean(existingAttempt);

    return res.status(200).json({ quizAssignment: payload });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

exports.getTeacherQuizReport = async (req, res) => {
  try {
    const quizAssignment = await QuizAssignment.findOne({
      _id: req.params.id,
      teacher: req.teacher._id,
    }).populate("students", "-password");

    if (!quizAssignment) {
      return res.status(404).json({ message: "Quiz assignment not found" });
    }

    const attempts = await QuizAttempt.find({
      quizAssignment: quizAssignment._id,
      teacher: req.teacher._id,
    }).populate("student", "-password");

    const report = {
      quizAssignmentId: quizAssignment._id,
      title: quizAssignment.title,
      totalAssignedStudents: quizAssignment.students.length,
      totalAttempts: attempts.length,
      averageScore:
        attempts.length > 0
          ? Number(
              (
                attempts.reduce((sum, attempt) => sum + attempt.score, 0) / attempts.length
              ).toFixed(2)
            )
          : 0,
      attempts,
    };

    return res.status(200).json({ report });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};
