const Question = require("../models/questionModel");
const Skill = require("../models/skillModel");
const XLSX = require("xlsx");

const validateQuestionPayload = (type, options, correctAnswerText) => {
  if (type === "mcq" || type === "true_false") {
    if (!Array.isArray(options) || options.length < 2) {
      throw new Error("At least two options are required for objective questions");
    }

    if (type === "mcq" && options.length !== 4) {
      throw new Error("MCQ questions must have exactly four options");
    }

    if (type === "true_false" && options.length !== 2) {
      throw new Error("True/false questions must have exactly two options");
    }

    const correctOptions = options.filter((option) => option.isCorrect);
    if (correctOptions.length !== 1) {
      throw new Error("Exactly one correct option is required");
    }
  }

  if (type === "short_answer" && !correctAnswerText) {
    throw new Error("correctAnswerText is required for short answer questions");
  }
};

const normalizeObjectiveOptions = (rawOptions) => {
  if (Array.isArray(rawOptions)) {
    return rawOptions.map((option) => ({
      text: String(option.text || "").trim(),
      isCorrect: Boolean(option.isCorrect),
    }));
  }

  if (!rawOptions) {
    return [];
  }

  return String(rawOptions)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => {
      const [text, flag] = item.split("|").map((part) => part.trim());
      return {
        text,
        isCorrect: String(flag).toLowerCase() === "true",
      };
    });
};

const mapQuestionPayload = ({ topic, teacherId, skillId, row }) => {
  const type = row.type || "mcq";
  const options = type === "short_answer" ? [] : normalizeObjectiveOptions(row.options);
  const correctAnswerText =
    type === "short_answer" ? String(row.correctAnswerText || "").trim() : undefined;

  validateQuestionPayload(type, options, correctAnswerText);

  return {
    teacher: teacherId,
    skill: skillId,
    topicId: topic._id,
    topicTitle: topic.title,
    type,
    questionText: String(row.questionText || "").trim(),
    options,
    correctAnswerText,
    marks: Number(row.marks || 1),
    difficulty: row.difficulty || "medium",
    explanation: row.explanation || "",
  };
};

const getValidatedTopicContext = async ({ teacherId, skillId, topicId }) => {
  if (!skillId || !topicId) {
    throw new Error("skill and topicId are required");
  }

  const skill = await Skill.findOne({
    _id: skillId,
    teacher: teacherId,
    isActive: true,
    isDeleted: false,
  });

  if (!skill) {
    throw new Error("Skill not found");
  }

  const topic = skill.topics.id(topicId);
  if (!topic) {
    throw new Error("Topic not found in selected skill");
  }

  return { skill, topic };
};

const importQuestionsForTopic = async ({ teacherId, skillId, topicId, rows }) => {
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error("At least one question row is required");
  }

  const { topic } = await getValidatedTopicContext({ teacherId, skillId, topicId });

  const questionDocs = rows.map((row) => {
    if (!row.questionText) {
      throw new Error("Each row must include questionText");
    }

    return mapQuestionPayload({
      topic,
      teacherId,
      skillId,
      row,
    });
  });

  const insertedQuestions = await Question.insertMany(questionDocs, { ordered: true });
  return Question.find({ _id: { $in: insertedQuestions.map((question) => question._id) } })
    .populate("skill")
    .sort({ createdAt: -1 });
};

const normalizeSpreadsheetLink = (link) => {
  const value = String(link || "").trim();
  if (!value) {
    return "";
  }

  const googleMatch = value.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (googleMatch) {
    return `https://docs.google.com/spreadsheets/d/${googleMatch[1]}/export?format=xlsx`;
  }

  return value;
};

const parseWorkbookRows = (buffer) => {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
  return XLSX.utils.sheet_to_json(firstSheet, { defval: "" }).map((row) => ({
    questionText: row.questionText || row.QuestionText || row.question || row.Question,
    type: row.type || row.Type || "mcq",
    options: row.options || row.Options || "",
    correctAnswerText: row.correctAnswerText || row.CorrectAnswerText || "",
    marks: row.marks || row.Marks || 1,
    difficulty: row.difficulty || row.Difficulty || "medium",
    explanation: row.explanation || row.Explanation || "",
  }));
};

const buildQuestionSort = (sortBy = "createdAt", sortOrder = "desc") => {
  const direction = sortOrder === "asc" ? 1 : -1;
  const allowedSortFields = {
    createdAt: "createdAt",
    questionText: "questionText",
    marks: "marks",
    difficulty: "difficulty",
    topicTitle: "topicTitle",
  };

  return { [allowedSortFields[sortBy] || "createdAt"]: direction };
};

exports.createQuestion = async (req, res) => {
  try {
    const {
      skill: skillId,
      topicId,
      type = "mcq",
      questionText,
      options = [],
      correctAnswerText,
      marks,
      difficulty,
      explanation,
    } = req.body;

    if (!skillId || !topicId || !questionText) {
      return res.status(400).json({
        message: "skill, topicId and questionText are required",
      });
    }

    validateQuestionPayload(type, options, correctAnswerText);

    const { topic } = await getValidatedTopicContext({
      teacherId: req.teacher._id,
      skillId,
      topicId,
    });

    const question = await Question.create({
      teacher: req.teacher._id,
      skill: skillId,
      topicId,
      topicTitle: topic.title,
      type,
      questionText,
      options,
      correctAnswerText,
      marks,
      difficulty,
      explanation,
    });

    const populatedQuestion = await Question.findById(question._id).populate("skill");

    return res.status(201).json({
      message: "Question created successfully",
      question: populatedQuestion,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

exports.importQuestionsManual = async (req, res) => {
  try {
    const { skill: skillId, topicId, questions = [] } = req.body;

    const importedQuestions = await importQuestionsForTopic({
      teacherId: req.teacher._id,
      skillId,
      topicId,
      rows: questions,
    });

    return res.status(201).json({
      message: "Questions imported successfully",
      count: importedQuestions.length,
      questions: importedQuestions,
    });
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
};

exports.importQuestionsFromFile = async (req, res) => {
  try {
    const { skill: skillId, topicId } = req.body;

    if (!req.file?.buffer) {
      return res.status(400).json({ message: "An Excel file is required" });
    }

    const rows = parseWorkbookRows(req.file.buffer);

    const importedQuestions = await importQuestionsForTopic({
      teacherId: req.teacher._id,
      skillId,
      topicId,
      rows,
    });

    return res.status(201).json({
      message: "Questions imported from file successfully",
      count: importedQuestions.length,
      questions: importedQuestions,
    });
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
};

exports.importQuestionsFromSpreadsheetLink = async (req, res) => {
  try {
    const { skill: skillId, topicId, spreadsheetLink } = req.body;

    if (!spreadsheetLink) {
      return res.status(400).json({ message: "spreadsheetLink is required" });
    }

    const response = await fetch(normalizeSpreadsheetLink(spreadsheetLink));
    if (!response.ok) {
      throw new Error("Unable to fetch spreadsheet link");
    }

    const arrayBuffer = await response.arrayBuffer();
    const rows = parseWorkbookRows(Buffer.from(arrayBuffer));

    const importedQuestions = await importQuestionsForTopic({
      teacherId: req.teacher._id,
      skillId,
      topicId,
      rows,
    });

    return res.status(201).json({
      message: "Questions imported from spreadsheet link successfully",
      count: importedQuestions.length,
      questions: importedQuestions,
    });
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
};

exports.getQuestions = async (req, res) => {
  try {
    const {
      search = "",
      sortBy = "createdAt",
      sortOrder = "desc",
      page = 1,
      limit = 10,
    } = req.query;
    const normalizedPage = Math.max(Number(page) || 1, 1);
    const normalizedLimit = Math.min(Math.max(Number(limit) || 10, 1), 100);

    const filter = {
      teacher: req.teacher._id,
      isDeleted: req.query.deleted === "true",
    };

    if (req.query.skill) {
      filter.skill = req.query.skill;
    }

    if (req.query.topicId) {
      filter.topicId = req.query.topicId;
    }

    if (search.trim()) {
      const searchRegex = new RegExp(search.trim(), "i");
      filter.$or = [
        { questionText: searchRegex },
        { topicTitle: searchRegex },
        { difficulty: searchRegex },
      ];
    }

    const totalItems = await Question.countDocuments(filter);

    const questions = await Question.find(filter)
      .populate("skill")
      .sort(buildQuestionSort(sortBy, sortOrder))
      .skip((normalizedPage - 1) * normalizedLimit)
      .limit(normalizedLimit);

    return res.status(200).json({
      questions,
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

exports.getQuestionById = async (req, res) => {
  try {
    const question = await Question.findOne({
      _id: req.params.id,
      teacher: req.teacher._id,
      isDeleted: false,
    }).populate("skill");

    if (!question) {
      return res.status(404).json({ message: "Question not found" });
    }

    return res.status(200).json({ question });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

exports.updateQuestion = async (req, res) => {
  try {
    const existingQuestion = await Question.findOne({
      _id: req.params.id,
      teacher: req.teacher._id,
      isDeleted: false,
    });

    if (!existingQuestion) {
      return res.status(404).json({ message: "Question not found" });
    }

    let topicTitle = existingQuestion.topicTitle;

    if (req.body.skill || req.body.topicId) {
      const skillId = req.body.skill || existingQuestion.skill;
      const topicId = req.body.topicId || existingQuestion.topicId;

      const skill = await Skill.findOne({
        _id: skillId,
        teacher: req.teacher._id,
        isActive: true,
      });

      if (!skill) {
        return res.status(404).json({ message: "Skill not found" });
      }

      const topic = skill.topics.id(topicId);
      if (!topic) {
        return res.status(404).json({ message: "Topic not found in selected skill" });
      }

      topicTitle = topic.title;
    }

    const nextType = req.body.type || existingQuestion.type;
    const nextOptions = req.body.options || existingQuestion.options;
    const nextCorrectAnswerText = req.body.correctAnswerText || existingQuestion.correctAnswerText;
    validateQuestionPayload(nextType, nextOptions, nextCorrectAnswerText);

    const question = await Question.findByIdAndUpdate(
      req.params.id,
      {
        ...req.body,
        topicTitle,
      },
      { returnDocument: "after", runValidators: true }
    ).populate("skill");

    return res.status(200).json({
      message: "Question updated successfully",
      question,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

exports.deleteQuestion = async (req, res) => {
  try {
    const question = await Question.findOneAndUpdate(
      {
        _id: req.params.id,
        teacher: req.teacher._id,
        isDeleted: false,
      },
      {
        isDeleted: true,
        isActive: false,
      },
      { returnDocument: "after" }
    );

    if (!question) {
      return res.status(404).json({ message: "Question not found" });
    }

    return res.status(200).json({ message: "Question deleted successfully" });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

exports.restoreQuestion = async (req, res) => {
  try {
    const question = await Question.findOneAndUpdate(
      {
        _id: req.params.id,
        teacher: req.teacher._id,
        isDeleted: true,
      },
      {
        isDeleted: false,
        isActive: true,
      },
      { returnDocument: "after" }
    ).populate("skill");

    if (!question) {
      return res.status(404).json({ message: "Question not found" });
    }

    return res.status(200).json({
      message: "Question restored successfully",
      question,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

exports.hardDeleteQuestion = async (req, res) => {
  try {
    const question = await Question.findOneAndDelete({
      _id: req.params.id,
      teacher: req.teacher._id,
    });

    if (!question) {
      return res.status(404).json({ message: "Question not found" });
    }

    return res.status(200).json({ message: "Question permanently deleted successfully" });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

exports.downloadQuestionTemplate = async (req, res) => {
  try {
    const sampleRows = [
      {
        questionText: "What is 2 + 2?",
        type: "mcq",
        options: "1|false, 2|false, 3|false, 4|true",
        correctAnswerText: "",
        marks: 1,
        difficulty: "easy",
        explanation: "Basic arithmetic",
      },
      {
        questionText: "JavaScript is single-threaded.",
        type: "true_false",
        options: "True|true, False|false",
        correctAnswerText: "",
        marks: 1,
        difficulty: "easy",
        explanation: "Event loop handles concurrency",
      },
      {
        questionText: "Define polymorphism.",
        type: "short_answer",
        options: "",
        correctAnswerText: "Ability of objects to take multiple forms",
        marks: 2,
        difficulty: "medium",
        explanation: "OOP concept",
      },
    ];

    const worksheet = XLSX.utils.json_to_sheet(sampleRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Questions");
    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

    res.setHeader(
      "Content-Disposition",
      'attachment; filename="question-import-template.xlsx"'
    );
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );

    return res.status(200).send(buffer);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};
