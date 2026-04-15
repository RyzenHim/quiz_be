const express = require("express");
const route = express.Router();

const quizAttemptController = require("../controllers/quizAttemptController");
const userController = require("../controllers/userController");
const { authenticateStudent } = require("../middlewares/studentAuthMiddleware");

route.post("/login", userController.loginStudent);

route.use(authenticateStudent);

route.get("/dashboard", userController.getStudentDashboard);
route.get("/me", userController.getStudentProfile);
route.patch("/profile", userController.updateStudentProfile);
route.patch("/profile/password", userController.changeStudentPassword);
route.get("/quizzes", userController.getAssignedQuizzes);
route.get("/quizzes/upcoming", userController.getUpcomingQuizzes);
route.get("/practice/topics", userController.getPracticeTopics);
route.get("/practice/questions", userController.getPracticeQuestions);
route.get("/quizzes/:id", quizAttemptController.getStudentQuizAssignmentForAttempt);
route.post("/quiz-attempts", quizAttemptController.submitQuizAttempt);
route.get("/quiz-attempts", quizAttemptController.getStudentQuizAttempts);

module.exports = route;
