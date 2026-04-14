const Course = require("../models/courseModel");
const Skill = require("../models/skillModel");

const validateSkillIds = async (teacherId, skillIds = []) => {
  if (!Array.isArray(skillIds) || skillIds.length === 0) {
    return [];
  }

  const skills = await Skill.find({
    _id: { $in: skillIds },
    teacher: teacherId,
    isActive: true,
  });

  if (skills.length !== skillIds.length) {
    throw new Error("One or more skills are invalid for this teacher");
  }

  return skillIds;
};

exports.createCourse = async (req, res) => {
  try {
    const { title, description, code, category, level, skills, durationInWeeks, status, startDate, endDate } = req.body;

    if (!title) {
      return res.status(400).json({ message: "Course title is required" });
    }

    const normalizedSkills = await validateSkillIds(req.teacher._id, skills);

    const existingCourse = await Course.findOne({
      teacher: req.teacher._id,
      title,
    });

    if (existingCourse) {
      return res.status(400).json({ message: "Course title already exists" });
    }

    const course = await Course.create({
      teacher: req.teacher._id,
      title,
      description,
      code,
      category,
      level,
      skills: normalizedSkills,
      durationInWeeks,
      status,
      startDate,
      endDate,
    });

    const populatedCourse = await Course.findById(course._id).populate("skills");

    return res.status(201).json({
      message: "Course created successfully",
      course: populatedCourse,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

exports.getCourses = async (req, res) => {
  try {
    const courses = await Course.find({
      teacher: req.teacher._id,
      isDeleted: false,
    }).populate("skills");

    return res.status(200).json({ courses });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

exports.getCourseById = async (req, res) => {
  try {
    const course = await Course.findOne({
      _id: req.params.id,
      teacher: req.teacher._id,
      isDeleted: false,
    }).populate("skills");

    if (!course) {
      return res.status(404).json({ message: "Course not found" });
    }

    return res.status(200).json({ course });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

exports.updateCourse = async (req, res) => {
  try {
    if (req.body.skills) {
      req.body.skills = await validateSkillIds(req.teacher._id, req.body.skills);
    }

    const course = await Course.findOneAndUpdate(
      {
        _id: req.params.id,
        teacher: req.teacher._id,
        isDeleted: false,
      },
      req.body,
      { new: true, runValidators: true }
    ).populate("skills");

    if (!course) {
      return res.status(404).json({ message: "Course not found" });
    }

    return res.status(200).json({
      message: "Course updated successfully",
      course,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

exports.softDeleteCourse = async (req, res) => {
  try {
    const course = await Course.findOneAndUpdate(
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
      { new: true }
    );

    if (!course) {
      return res.status(404).json({ message: "Course not found" });
    }

    return res.status(200).json({ message: "Course soft deleted successfully", course });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

exports.hardDeleteCourse = async (req, res) => {
  try {
    const course = await Course.findOneAndDelete({
      _id: req.params.id,
      teacher: req.teacher._id,
    });

    if (!course) {
      return res.status(404).json({ message: "Course not found" });
    }

    return res.status(200).json({ message: "Course permanently deleted" });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};
