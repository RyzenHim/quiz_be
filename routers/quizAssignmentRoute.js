const express = require("express");
const route = express.Router();

const quizAssignmentController = require("../controllers/quizAssignmentController");
const { authenticateTeacher } = require("../middlewares/authMiddleware");

route.use(authenticateTeacher);

route.post("/", quizAssignmentController.createQuizAssignment);
route.get("/", quizAssignmentController.getQuizAssignments);
route.get("/:id", quizAssignmentController.getQuizAssignmentById);

module.exports = route;
