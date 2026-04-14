const jwt = require("jsonwebtoken");
const Teacher = require("../models/teacherModel");

exports.authenticateTeacher = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "Authorization token is required" });
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const teacher = await Teacher.findOne({
      _id: decoded.teacherId,
      isDeleted: false,
      isActive: true,
    });

    if (!teacher) {
      return res.status(401).json({ message: "Teacher not found or inactive" });
    }

    req.teacher = teacher;
    next();
  } catch (error) {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
};
