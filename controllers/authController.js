const bcrypt = require("bcrypt");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const Teacher = require("../models/teacherModel");
const User = require("../models/userModel");
const { sendLoginNotification, sendPasswordResetOtp } = require("../utils/mailService");

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

const OTP_EXPIRY_MINUTES = 10;

const buildAuthPayload = (account, role) => ({
  message: "Login successful",
  token: signToken({
    id: account._id,
    email: account.email,
    role,
  }),
  role,
  landingPath: role === "teacher" ? "/teacher-dashboard" : "/student-dashboard",
  user: sanitizeUser(account),
  themePreference: account.themePreference || "light",
});

const findAccountByIdentifier = async (identifier) => {
  const normalizedIdentifier = String(identifier).trim().toLowerCase();

  let account = await Teacher.findOne({
    email: normalizedIdentifier,
    isDeleted: false,
    isActive: true,
  });

  let role = "teacher";

  if (!account) {
    account = await User.findOne({
      $or: [{ email: normalizedIdentifier }, { enrollmentNumber: String(identifier).trim() }],
      role: "student",
      isDeleted: false,
      isActive: true,
    }).populate("batch");
    role = "student";
  }

  return {
    account,
    role,
  };
};

const generateOtp = () => String(Math.floor(100000 + Math.random() * 900000));

const hashOtp = (otp) => crypto.createHash("sha256").update(String(otp)).digest("hex");

exports.login = async (req, res) => {
  try {
    const { identifier, password } = req.body;

    if (!identifier || !password) {
      return res.status(400).json({ message: "identifier and password are required" });
    }

    const { account, role } = await findAccountByIdentifier(identifier);

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

    sendLoginNotification({
      email: account.email,
      name: account.name,
      role,
    }).catch(() => null);

    return res.status(200).json(buildAuthPayload(account, role));
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

exports.requestForgotPasswordOtp = async (req, res) => {
  try {
    const { identifier } = req.body;

    if (!identifier) {
      return res.status(400).json({ message: "identifier is required" });
    }

    const { account } = await findAccountByIdentifier(identifier);

    if (!account || !account.email) {
      return res.status(404).json({ message: "Account not found" });
    }

    const otp = generateOtp();
    account.passwordResetOtpHash = hashOtp(otp);
    account.passwordResetOtpExpiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);
    await account.save();

    await sendPasswordResetOtp({
      email: account.email,
      name: account.name,
      otp,
    });

    return res.status(200).json({
      message: `OTP sent to ${account.email}`,
      email: account.email,
      expiresInMinutes: OTP_EXPIRY_MINUTES,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

exports.resetPasswordWithOtp = async (req, res) => {
  try {
    const { identifier, otp, newPassword, confirmPassword } = req.body;

    if (!identifier || !otp || !newPassword || !confirmPassword) {
      return res.status(400).json({
        message: "identifier, otp, newPassword and confirmPassword are required",
      });
    }

    if (String(newPassword).length < 6) {
      return res.status(400).json({ message: "New password must be at least 6 characters long" });
    }

    if (String(newPassword) !== String(confirmPassword)) {
      return res.status(400).json({ message: "Password and confirm password must match" });
    }

    const { account, role } = await findAccountByIdentifier(identifier);

    if (!account) {
      return res.status(404).json({ message: "Account not found" });
    }

    if (!account.passwordResetOtpHash || !account.passwordResetOtpExpiresAt) {
      return res.status(400).json({ message: "Password reset OTP was not requested" });
    }

    if (account.passwordResetOtpExpiresAt.getTime() < Date.now()) {
      return res.status(400).json({ message: "OTP has expired. Please request a new OTP." });
    }

    const submittedOtpHash = hashOtp(otp);
    if (submittedOtpHash !== account.passwordResetOtpHash) {
      return res.status(400).json({ message: "Invalid OTP" });
    }

    account.password = await bcrypt.hash(newPassword, 10);
    account.passwordResetOtpHash = undefined;
    account.passwordResetOtpExpiresAt = undefined;

    if (role === "teacher") {
      account.lastLoginAt = new Date();
    }

    await account.save();

    sendLoginNotification({
      email: account.email,
      name: account.name,
      role,
    }).catch(() => null);

    return res.status(200).json({
      message: "Password reset successful",
      ...buildAuthPayload(account, role),
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
