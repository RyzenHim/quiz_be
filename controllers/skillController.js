const mongoose = require("mongoose");
const Skill = require("../models/skillModel");
const Question = require("../models/questionModel");

const normalizeTopics = (topics = []) => {
  if (!Array.isArray(topics)) {
    return [];
  }

  const seenTitles = new Set();

  return topics
    .map((topic) => ({
      _id: topic._id || undefined,
      title: String(topic.title || "").trim(),
      description: String(topic.description || "").trim(),
      isActive: topic.isActive !== false,
    }))
    .filter((topic) => topic.title)
    .filter((topic) => {
      const normalizedTitle = topic.title.toLowerCase();
      if (seenTitles.has(normalizedTitle)) {
        return false;
      }
      seenTitles.add(normalizedTitle);
      return true;
    });
};

const validateTopicPayload = (topics) => {
  const normalizedTopics = normalizeTopics(topics);

  if ((topics || []).some((topic) => !String(topic.title || "").trim())) {
    throw new Error("Each topic must include a title");
  }

  if (normalizedTopics.length !== (topics || []).length) {
    throw new Error("Topic titles must be unique and non-empty");
  }

  return normalizedTopics;
};

exports.createSkill = async (req, res) => {
  try {
    const { name, description, topics = [] } = req.body;

    if (!name) {
      return res.status(400).json({ message: "Skill name is required" });
    }

    const existingSkill = await Skill.findOne({
      teacher: req.teacher._id,
      name,
    });

    if (existingSkill) {
      return res.status(400).json({ message: "Skill already exists" });
    }

    const skill = await Skill.create({
      teacher: req.teacher._id,
      name,
      description,
      topics: validateTopicPayload(topics),
    });

    return res.status(201).json({
      message: "Skill created successfully",
      skill,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

exports.getSkills = async (req, res) => {
  try {
    const skills = await Skill.find({
      teacher: req.teacher._id,
      isDeleted: req.query.deleted === "true",
    }).sort({ createdAt: -1 });
    return res.status(200).json({ skills });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

exports.getSkillById = async (req, res) => {
  try {
    const skill = await Skill.findOne({
      _id: req.params.id,
      teacher: req.teacher._id,
      isDeleted: false,
    });

    if (!skill) {
      return res.status(404).json({ message: "Skill not found" });
    }

    return res.status(200).json({ skill });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

exports.updateSkill = async (req, res) => {
  try {
    const skill = await Skill.findOne({
      _id: req.params.id,
      teacher: req.teacher._id,
      isDeleted: false,
    });

    if (!skill) {
      return res.status(404).json({ message: "Skill not found" });
    }

    const updatePayload = { ...req.body };

    if (req.body.topics) {
      const nextTopics = validateTopicPayload(req.body.topics);
      const currentTopicIds = new Set((skill.topics || []).map((topic) => String(topic._id)));
      const nextTopicIds = new Set(
        nextTopics
          .filter((topic) => topic._id)
          .map((topic) => String(topic._id))
      );

      const removedTopicIds = Array.from(currentTopicIds).filter((topicId) => !nextTopicIds.has(topicId));

      if (removedTopicIds.length > 0) {
        const linkedQuestions = await Question.find({
          teacher: req.teacher._id,
          skill: skill._id,
          topicId: { $in: removedTopicIds.map((topicId) => new mongoose.Types.ObjectId(topicId)) },
          isDeleted: false,
        }).select("topicTitle");

        if (linkedQuestions.length > 0) {
          const blockedTopics = Array.from(new Set(linkedQuestions.map((question) => question.topicTitle))).join(", ");
          return res.status(400).json({
            message: `You cannot remove topics already used by questions: ${blockedTopics}`,
          });
        }
      }

      updatePayload.topics = nextTopics;
    }

    Object.assign(skill, updatePayload);
    await skill.save();

    return res.status(200).json({
      message: "Skill updated successfully",
      skill,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

exports.softDeleteSkill = async (req, res) => {
  try {
    const skill = await Skill.findOneAndUpdate(
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

    if (!skill) {
      return res.status(404).json({ message: "Skill not found" });
    }

    return res.status(200).json({ message: "Skill deleted successfully" });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

exports.hardDeleteSkill = async (req, res) => {
  try {
    const skill = await Skill.findOneAndDelete({
      _id: req.params.id,
      teacher: req.teacher._id,
    });

    if (!skill) {
      return res.status(404).json({ message: "Skill not found" });
    }

    return res.status(200).json({ message: "Skill permanently deleted successfully" });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};
