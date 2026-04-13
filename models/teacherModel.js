
const mongoose = require("mongoose");

const teacherSchema = new mongoose.Schema({
  name: String,
  email: String,
  password: String,
  role: {
    type: String,
    enum: ["student", "teacher", "admin"],
    default: "teacher"
  }
});

module.exports = mongoose.model("Teacher", teacherSchema);