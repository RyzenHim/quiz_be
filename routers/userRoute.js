const express=require("express");
const route=express.Router();

const userController=require("../controllers/userController");

route.post("/",userController.adduser);
route.get("/findall",userController.alluser)
route.get("/findone/:id",userController.oneuser)

module.exports=route