const jwt = require("jsonwebtoken");
const User = require("../models/userModel");

exports.authenticateStudent = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "Authorization token is required" });
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const student = await User.findOne({
      _id: decoded.studentId,
      role: "student",
      isDeleted: false,
      isActive: true,
    }).populate("batch");

    if (!student) {
      return res.status(401).json({ message: "Student not found or inactive" });
    }

    req.student = student;
    next();
  } catch (error) {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
};
