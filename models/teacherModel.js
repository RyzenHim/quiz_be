
const mongoose = require("mongoose");

const teacherSchema = new mongoose.Schema({
  name: String,
  email: String,
  password: String,
});

module.exports = mongoose.model("Teacher", teacherSchema);