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

const isStudentAssignedToQuiz = (quizAssignment, studentId) =>
  (quizAssignment.students || []).some((student) => {
    const assignedStudentId = student?._id || student;
    return String(assignedStudentId) === String(studentId);
  });

const buildResultQuestion = (question, answer) => {
  const correctOptions = (question.options || []).filter((option) => option.isCorrect);

  return {
    _id: question._id,
    questionText: question.questionText,
    type: question.type,
    topicTitle: question.topicTitle,
    explanation: question.explanation || "",
    marks: question.marks,
    difficulty: question.difficulty,
    skill: question.skill,
    options: (question.options || []).map((option) => ({
      _id: option._id,
      text: option.text,
      isCorrect: Boolean(option.isCorrect),
    })),
    submittedAnswer: {
      selectedOptionIds: answer?.selectedOptionIds || [],
      answerText: answer?.answerText || "",
      isCorrect: Boolean(answer?.isCorrect),
      obtainedMarks: answer?.obtainedMarks || 0,
    },
    correctAnswerText:
      question.type === "short_answer"
        ? question.correctAnswerText || ""
        : correctOptions.map((option) => option.text).join(", "),
  };
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

    const studentAssigned = isStudentAssignedToQuiz(quizAssignment, req.student._id);

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

exports.getStudentQuizResult = async (req, res) => {
  try {
    const attempt = await QuizAttempt.findOne({
      student: req.student._id,
      quizAssignment: req.params.id,
    })
      .populate({
        path: "quizAssignment",
        populate: [
          { path: "course", select: "title" },
          { path: "batch", select: "batchName" },
          { path: "teacher", select: "name email" },
          {
            path: "questions",
            populate: {
              path: "skill",
              select: "name",
            },
          },
        ],
      })
      .populate("student", "name email enrollmentNumber");

    if (!attempt) {
      return res.status(404).json({ message: "Quiz result not found" });
    }

    const answerMap = new Map(attempt.answers.map((answer) => [String(answer.question), answer]));
    const quizAssignmentObject = attempt.quizAssignment.toObject();
    const resultQuestions = (quizAssignmentObject.questions || []).map((question) =>
      buildResultQuestion(question, answerMap.get(String(question._id)))
    );

    return res.status(200).json({
      attempt: {
        ...attempt.toObject(),
        quizAssignment: {
          ...quizAssignmentObject,
          questions: resultQuestions,
        },
      },
    });
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

    const studentAssigned = isStudentAssignedToQuiz(quizAssignment, req.student._id);

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
