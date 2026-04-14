const User=require("../models/userModel")
const express =require("express");
const bcrypt=require("bcrypt")

exports.adduser=async(req,res)=>{
    try {
        const {name,email,password}=req.body
        if(!(name&&email&&password)){
            return res.status(400).json({message:"all input aer required"})
        }
        const existingemail=await User.findOne({email})
        if(existingemail){
            return res.status(400).json({message:"email alredy existing"})
        }
        const salt =bcrypt.genSaltSync(10);
        const hash=bcrypt.hashSync(password,salt)

        const data={name,email,password:hash}
        const server=new User(data);
        await server.save();

        return res.status(200).json({message:"new user added"})

    } catch (error) {
        return res.status(500).json({error:error.message})
    }
}

exports.alluser=async(req,res)=>{
    try {
        const alluser=await User.find();
        if(!alluser){
            return res.status(400).json({message:"all user not found"})
        }
        return res.status(200).json(alluser)
    } catch (error) {
        return res.status(500).json({error:error.message})
        
    }
}

exports.oneuser=async(req,res)=>{
    try {
        const {id}=req.params
        const oneuser=await User.findOne(id)
        if(!oneuser){
            return res.status(400).json({message:"user not found"})
        }
        return res.status(200).json(oneuser)
    } catch (error) {
        
    }
}