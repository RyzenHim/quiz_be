const Teacher=require("../models/teacherModel")
const User=require("../models/userModel")
const experss=require("express");
const bcrypt=require("bcrypt");
const jwt=require("jsonwebtoken")

exports.teacheradd=async(req,res)=>{
    try {
        // console.log(req.body);
        
        const {name,email,password}=req.body;
        if(!(name&&email&&password)){
            res.status(400).json({message:"all fild are required"})
        }
        // const existemail=await User.findOne(email)
        // if(!existemail){
        //     res.status(400).json({message:"email are allready existing"})
        // }

        const salt=bcrypt.genSaltSync(10)
        const hash=bcrypt.hashSync(password,salt)

        const data={name,email,password:hash}
        //  const server2=new User({
        //     name:name,
        //     email:email,
        //     password:password,
        //  })
        // await server2.save()
        const server=new Teacher(data)
        await server.save()
       
        return res.status(200).json({message:"new teacher added"},server)

    } catch (error) {
        return res.status(500).json({error:error.message})
    }
}

exports.teacherall=async(req,res)=>{
    try {
        const alldata=await Teacher.find();
        if(!alldata){
            return res.status(400).json({message:"all data not found"})
        }
        return res.status(400).json(alldata)
    } catch (error) {
        return res.status(500).json({error:error.message})
    }
}


exports.teacherone=async(req,res)=>{
    try {
        const {id}=req.params;
        const findone=await Teacher.findById(id)
        if(!findone){
            return res.status(400).json({message:"user not found"})
        }
        return res.status(200).json(findone)
    } catch (error) {
        return res.status(500).json({error:error.message})
    }
}

exports.teacherupdate=async(req,res)=>{
    try {
        const {id}=req.params
        const data=req.body
        
        const teacherupdate=await Teacher.findByIdAndUpdate(id,data,{new:true})
        if(!teacherupdate){
            return res.status(400).json({message:"teacher not found"})
                }
                return res.status(200).json(teacherupdate)
    } catch (error) {
        return res.status(500).json({error:error.message})
    }
}

exports.teacherdelete=async(req,res)=>{
    try {
        const {id}=req.params
        const teacherdelete=await Teacher.findByIdAndDelete(id)
        if(!teacherdelete){
            return res.status(400).json({message:"teacher not found"})
        }
        return res.status(200).json(teacherdelete)
    } catch (error) {
        return res.status(500).json({error:error.message})
    }
}