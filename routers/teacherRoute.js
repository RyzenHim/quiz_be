const express = require("express");
const route = express.Router();

const teacherController = require("../controllers/teacherController");
const { authenticateTeacher } = require("../middlewares/authMiddleware");

route.post("/register", teacherController.registerTeacher);
route.post("/login", teacherController.loginTeacher);
route.get("/me", authenticateTeacher, teacherController.getTeacherProfile);
route.patch("/profile", authenticateTeacher, teacherController.updateTeacherProfile);
route.patch("/profile/password", authenticateTeacher, teacherController.changeTeacherPassword);
route.get("/", teacherController.getTeachers);

module.exports = route;
