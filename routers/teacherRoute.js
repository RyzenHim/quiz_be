const express =require("express")
const route=express.Router()

const teacherController=require("../controllers/teacherController")

route.post("/",teacherController.teacheradd);


module.exports=route