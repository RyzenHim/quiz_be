const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const Teacher = require("../models/teacherModel");
const User = require("../models/userModel");
const { sendLoginNotification } = require("../utils/mailService");

const sanitizeUser = (user) => {
  const payload = user.toObject ? user.toObject() : { ...user };
  delete payload.password;
  return payload;
};

const signToken = ({ id, email, role }) => {
  const payload = { email, role };

  if (role === "teacher") {
    payload.teacherId = id;
  } else {
    payload.studentId = id;
  }

  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: "7d" });
};

exports.login = async (req, res) => {
  try {
    const { identifier, password } = req.body;

    if (!identifier || !password) {
      return res.status(400).json({ message: "identifier and password are required" });
    }

    const normalizedIdentifier = String(identifier).trim().toLowerCase();

    let account = await Teacher.findOne({
      email: normalizedIdentifier,
      isDeleted: false,
      isActive: true,
    });

    let role = "teacher";

    if (!account) {
      account = await User.findOne({
        $or: [{ email: normalizedIdentifier }, { enrollmentNumber: identifier }],
        role: "student",
        isDeleted: false,
        isActive: true,
      }).populate("batch");
      role = "student";
    }

    if (!account || !account.password) {
      return res.status(404).json({ message: "Account not found" });
    }

    const passwordMatched = await bcrypt.compare(password, account.password);
    if (!passwordMatched) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    if (role === "teacher") {
      account.lastLoginAt = new Date();
      await account.save();
    }

    const token = signToken({
      id: account._id,
      email: account.email,
      role,
    });

    sendLoginNotification({
      email: account.email,
      name: account.name,
      role,
    }).catch(() => null);

    return res.status(200).json({
      message: "Login successful",
      token,
      role,
      landingPath: role === "teacher" ? "/teacher-dashboard" : "/student-dashboard",
      user: sanitizeUser(account),
      themePreference: account.themePreference || "light",
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

exports.getMe = async (req, res) => {
  return res.status(200).json({
    role: req.authRole,
    user: sanitizeUser(req.authUser),
    themePreference: req.authUser.themePreference || "light",
  });
};

exports.updateThemePreference = async (req, res) => {
  try {
    const { themePreference } = req.body;

    if (!["light", "dark"].includes(themePreference)) {
      return res.status(400).json({ message: "themePreference must be light or dark" });
    }

    const Model = req.authRole === "teacher" ? Teacher : User;

    const updatedUser = await Model.findByIdAndUpdate(
      req.authUser._id,
      { themePreference },
      { returnDocument: "after", runValidators: true }
    ).select("-password");

    return res.status(200).json({
      message: "Theme preference updated successfully",
      role: req.authRole,
      user: updatedUser,
      themePreference,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};
