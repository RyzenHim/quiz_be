require("dotenv").config();

const cors = require("cors");
const express = require("express");
const mongoose = require("mongoose");

const app = express();

mongoose
  .connect(process.env.URL)
  .then(() => {
    console.log("database connected");
  })
  .catch((err) => {
    console.log("database not connected", err);
  });

app.use(cors());
app.use(express.json());

const teacherRoute = require("./routers/teacherRoute");
const userRoute = require("./routers/userRoute");
const courseRoute = require("./routers/courseRoute");
const batchRoute = require("./routers/batchRoute");
const skillRoute = require("./routers/skillRoute");
const quizAssignmentRoute = require("./routers/quizAssignmentRoute");

app.use("/teacher", teacherRoute);
app.use("/students", userRoute);
app.use("/courses", courseRoute);
app.use("/batches", batchRoute);
app.use("/skills", skillRoute);
app.use("/quiz-assignments", quizAssignmentRoute);

app.listen(process.env.PORT, () => {
  console.log(`server is running on ${process.env.PORT}`);
});
