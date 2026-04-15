const express = require("express");
const route = express.Router();

const skillController = require("../controllers/skillController");
const { authenticateTeacher } = require("../middlewares/authMiddleware");

route.use(authenticateTeacher);

route.post("/", skillController.createSkill);
route.get("/", skillController.getSkills);
route.get("/:id", skillController.getSkillById);
route.put("/:id", skillController.updateSkill);
route.delete("/soft-delete/:id", skillController.softDeleteSkill);
route.delete("/hard-delete/:id", skillController.hardDeleteSkill);

module.exports = route;
