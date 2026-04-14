const express = require("express");
const route = express.Router();

const quizAttemptController = require("../controllers/quizAttemptController");
const userController = require("../controllers/userController");
const { authenticateStudent } = require("../middlewares/studentAuthMiddleware");

route.post("/login", userController.loginStudent);

route.use(authenticateStudent);

route.get("/me", userController.getStudentProfile);
route.get("/quizzes", userController.getAssignedQuizzes);
route.get("/quizzes/:id", quizAttemptController.getStudentQuizAssignmentForAttempt);
route.post("/quiz-attempts", quizAttemptController.submitQuizAttempt);
route.get("/quiz-attempts", quizAttemptController.getStudentQuizAttempts);

module.exports = route;
