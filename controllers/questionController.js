const Question = require("../models/questionModel");
const Skill = require("../models/skillModel");

const validateQuestionPayload = (type, options, correctAnswerText) => {
  if (type === "mcq" || type === "true_false") {
    if (!Array.isArray(options) || options.length < 2) {
      throw new Error("At least two options are required for objective questions");
    }

    const correctOptions = options.filter((option) => option.isCorrect);
    if (correctOptions.length === 0) {
      throw new Error("At least one correct option is required");
    }
  }

  if (type === "short_answer" && !correctAnswerText) {
    throw new Error("correctAnswerText is required for short answer questions");
  }
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

exports.getQuestions = async (req, res) => {
  try {
    const filter = {
      teacher: req.teacher._id,
      isDeleted: false,
    };

    if (req.query.skill) {
      filter.skill = req.query.skill;
    }

    if (req.query.topicId) {
      filter.topicId = req.query.topicId;
    }

    const questions = await Question.find(filter).populate("skill").sort({ createdAt: -1 });

    return res.status(200).json({ questions });
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
