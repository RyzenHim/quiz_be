const express = require("express");
const route = express.Router();
const multer = require("multer");

const questionController = require("../controllers/questionController");
const { authenticateTeacher } = require("../middlewares/authMiddleware");

const upload = multer({ storage: multer.memoryStorage() });

route.use(authenticateTeacher);

route.post("/", questionController.createQuestion);
route.post("/import/manual", questionController.importQuestionsManual);
route.post("/import/file", upload.single("file"), questionController.importQuestionsFromFile);
route.post("/import/spreadsheet-link", questionController.importQuestionsFromSpreadsheetLink);
route.get("/template/download", questionController.downloadQuestionTemplate);
route.get("/", questionController.getQuestions);
route.get("/:id", questionController.getQuestionById);
route.put("/:id", questionController.updateQuestion);
route.delete("/soft-delete/:id", questionController.deleteQuestion);
route.patch("/restore/:id", questionController.restoreQuestion);
route.delete("/hard-delete/:id", questionController.hardDeleteQuestion);

module.exports = route;
