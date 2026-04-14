const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const Teacher = require("../models/teacherModel");

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

exports.getTeachers = async (req, res) => {
  try {
    const teachers = await Teacher.find({ isDeleted: false }).select("-password");
    return res.status(200).json({ teachers });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};
