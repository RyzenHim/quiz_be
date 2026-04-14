const Skill = require("../models/skillModel");

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
      topics,
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
    const skills = await Skill.find({ teacher: req.teacher._id }).sort({ createdAt: -1 });
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
    const skill = await Skill.findOneAndUpdate(
      {
        _id: req.params.id,
        teacher: req.teacher._id,
      },
      req.body,
      { new: true, runValidators: true }
    );

    if (!skill) {
      return res.status(404).json({ message: "Skill not found" });
    }

    return res.status(200).json({
      message: "Skill updated successfully",
      skill,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

exports.deleteSkill = async (req, res) => {
  try {
    const skill = await Skill.findOneAndDelete({
      _id: req.params.id,
      teacher: req.teacher._id,
    });

    if (!skill) {
      return res.status(404).json({ message: "Skill not found" });
    }

    return res.status(200).json({ message: "Skill deleted successfully" });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};
