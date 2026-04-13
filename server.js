require('dotenv').config();
const express=require("express");
const mongoose=require("mongoose");
const app=express();


mongoose.connect(process.env.URL)
.then(()=>{console.log("data base connected")})
.catch((err)=>{console.log("database not connected",err)});
app.use(express.json())
const teacherRoute=require("./routers/teacherRoute");
app.use("/teacher",teacherRoute);

app.listen(process.env.PORT,()=>{
     console.log(`server is running on ${process.env.PORT}`)
})