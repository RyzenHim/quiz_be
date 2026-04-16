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
app.use(
  cors({
    origin: ["https://quiz-fe-liard-ten.vercel.app", "http://localhost:3000"],
    credentials: true,
  }),
);
app.use(express.json());

const authRoute = require("./routers/authRoute");
const teacherRoute = require("./routers/teacherRoute");
const userRoute = require("./routers/userRoute");
const studentRoute = require("./routers/studentRoute");
const courseRoute = require("./routers/courseRoute");
const batchRoute = require("./routers/batchRoute");
const skillRoute = require("./routers/skillRoute");
const questionRoute = require("./routers/questionRoute");
const quizAssignmentRoute = require("./routers/quizAssignmentRoute");
const quizAttemptRoute = require("./routers/quizAttemptRoute");

app.use("/auth", authRoute);
app.use("/teacher", teacherRoute);
app.use("/students", userRoute);
app.use("/student", studentRoute);
app.use("/courses", courseRoute);
app.use("/batches", batchRoute);
app.use("/skills", skillRoute);
app.use("/questions", questionRoute);
app.use("/quiz-assignments", quizAssignmentRoute);
app.use("/quiz-attempts", quizAttemptRoute);

app.listen(process.env.PORT, () => {
  console.log(`server is running on ${process.env.PORT}`);
});
