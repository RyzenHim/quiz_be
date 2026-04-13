const teacher=require("../models/teacherModel")
const user=require("../models/userModel")
const experss=require("express");

exports.teacheradd=async(req,res)=>{
    try {
        const {name,email,password}=req.body;
        if(!(name&&email&&password)){
            res.sataus(400).json({message:"all fild are required"})
        }
        const existemail=await teacher.findOne(email)
        if(!existemail){
            res.sataus(400).json({message:"email are allready existing"})
        }

    } catch (error) {
        
    }
}