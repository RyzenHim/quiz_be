const express =require("express")
const route=express.Router()

const teacherController=require("../controllers/teacherController")

route.post("/",teacherController.teacheradd);
route.get("/findall",teacherController.teacherall);
route.get("/findone/:id",teacherController.teacherone);
route.put("/update/:id",teacherController.teacherupdate);
route.delete("/delete/:id",teacherController.teacherdelete);
// route.delete("/softdelete/:id",teacherController.teachersoftdelete);


module.exports=route