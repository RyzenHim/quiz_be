const express = require("express");
const route = express.Router();

const userController = require("../controllers/userController");
const { authenticateTeacher } = require("../middlewares/authMiddleware");

route.use(authenticateTeacher);

route.post("/", userController.adduser);
route.get("/", userController.alluser);
route.get("/:id", userController.oneuser);
route.put("/:id", userController.updateUser);
route.delete("/soft-delete/:id", userController.softDeleteUser);
route.patch("/restore/:id", userController.restoreUser);
route.delete("/hard-delete/:id", userController.hardDeleteUser);

module.exports = route;
