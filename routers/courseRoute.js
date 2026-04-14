const express = require("express");
const route = express.Router();

const courseController = require("../controllers/courseController");
const { authenticateTeacher } = require("../middlewares/authMiddleware");

route.use(authenticateTeacher);

route.post("/", courseController.createCourse);
route.get("/", courseController.getCourses);
route.get("/:id", courseController.getCourseById);
route.put("/:id", courseController.updateCourse);
route.delete("/soft-delete/:id", courseController.softDeleteCourse);
route.delete("/hard-delete/:id", courseController.hardDeleteCourse);

module.exports = route;
