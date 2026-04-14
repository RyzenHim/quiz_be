const jwt = require("jsonwebtoken");
const Teacher = require("../models/teacherModel");
const User = require("../models/userModel");

exports.authenticateAnyUser = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "Authorization token is required" });
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (decoded.role === "teacher") {
      const teacher = await Teacher.findOne({
        _id: decoded.teacherId,
        isDeleted: false,
        isActive: true,
      }).select("-password");

      if (!teacher) {
        return res.status(401).json({ message: "Teacher not found or inactive" });
      }

      req.authUser = teacher;
      req.authRole = "teacher";
      return next();
    }

    if (decoded.role === "student") {
      const student = await User.findOne({
        _id: decoded.studentId,
        role: "student",
        isDeleted: false,
        isActive: true,
      })
        .select("-password")
        .populate("batch");

      if (!student) {
        return res.status(401).json({ message: "Student not found or inactive" });
      }

      req.authUser = student;
      req.authRole = "student";
      return next();
    }

    return res.status(401).json({ message: "Invalid token role" });
  } catch (error) {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
};
