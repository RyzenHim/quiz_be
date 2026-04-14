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

module.exports = route;
