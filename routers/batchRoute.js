const express = require("express");
const route = express.Router();

const batchController = require("../controllers/batchController");
const { authenticateTeacher } = require("../middlewares/authMiddleware");

route.use(authenticateTeacher);

route.post("/", batchController.createBatch);
route.get("/", batchController.getBatches);
route.get("/:id", batchController.getBatchById);
route.put("/:id", batchController.updateBatch);
route.delete("/soft-delete/:id", batchController.softDeleteBatch);
route.delete("/hard-delete/:id", batchController.hardDeleteBatch);

module.exports = route;
