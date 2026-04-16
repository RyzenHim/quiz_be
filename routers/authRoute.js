const express = require("express");
const route = express.Router();

const authController = require("../controllers/authController");
const { authenticateAnyUser } = require("../middlewares/anyAuthMiddleware");

route.post("/login", authController.login);
route.post("/forgot-password/request-otp", authController.requestForgotPasswordOtp);
route.post("/forgot-password/reset", authController.resetPasswordWithOtp);
route.get("/me", authenticateAnyUser, authController.getMe);
route.patch("/theme", authenticateAnyUser, authController.updateThemePreference);

module.exports = route;
