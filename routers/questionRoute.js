const express = require("express");
const route = express.Router();

const questionController = require("../controllers/questionController");
const { authenticateTeacher } = require("../middlewares/authMiddleware");

route.use(authenticateTeacher);

route.post("/", questionController.createQuestion);
route.get("/", questionController.getQuestions);
route.get("/:id", questionController.getQuestionById);
route.put("/:id", questionController.updateQuestion);
route.delete("/:id", questionController.deleteQuestion);

module.exports = route;
