const express = require("express");
const route = express.Router();

const skillController = require("../controllers/skillController");
const { authenticateTeacher } = require("../middlewares/authMiddleware");

route.use(authenticateTeacher);

route.post("/", skillController.createSkill);
route.get("/", skillController.getSkills);
route.get("/:id", skillController.getSkillById);
route.put("/:id", skillController.updateSkill);
route.delete("/:id", skillController.deleteSkill);

module.exports = route;
