const express = require("express");
const route = express.Router();

const quizAttemptController = require("../controllers/quizAttemptController");
const { authenticateTeacher } = require("../middlewares/authMiddleware");

route.use(authenticateTeacher);

route.get("/", quizAttemptController.getTeacherQuizAttempts);
route.get("/report/:id", quizAttemptController.getTeacherQuizReport);

module.exports = route;
