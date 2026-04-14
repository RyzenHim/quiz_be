const bcrypt = require("bcrypt");
const Batch = require("../models/batchModel");
const User = require("../models/userModel");

const sanitizeStudent = (student) => {
  const studentObject = student.toObject();
  delete studentObject.password;
  return studentObject;
};

exports.adduser = async (req, res) => {
  try {
    const {
      name,
      email,
      password,
      batch: batchId,
      enrollmentNumber,
      phone,
      guardianName,
      guardianPhone,
      address,
      dateOfBirth,
    } = req.body;

    if (!name || !email || !batchId || !enrollmentNumber) {
      return res.status(400).json({
        message: "name, email, batch and enrollmentNumber are required",
      });
    }

    const batch = await Batch.findOne({
      _id: batchId,
      teacher: req.teacher._id,
      isDeleted: false,
    });

    if (!batch) {
      return res.status(404).json({ message: "Batch not found for this teacher" });
    }

    const existingStudent = await User.findOne({
      $or: [{ email: email.toLowerCase() }, { enrollmentNumber, teacher: req.teacher._id }],
    });

    if (existingStudent) {
      return res.status(400).json({
        message: "Student already exists with this email or enrollment number",
      });
    }

    const hashedPassword = password ? await bcrypt.hash(password, 10) : undefined;

    const student = await User.create({
      name,
      email,
      password: hashedPassword,
      role: "student",
      teacher: req.teacher._id,
      batch: batchId,
      enrollmentNumber,
      phone,
      guardianName,
      guardianPhone,
      address,
      dateOfBirth,
    });

    await Batch.findByIdAndUpdate(batchId, {
      $addToSet: { students: student._id },
    });

    const populatedStudent = await User.findById(student._id)
      .populate("teacher", "-password")
      .populate("batch");

    return res.status(201).json({
      message: "Student created successfully",
      student: sanitizeStudent(populatedStudent),
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

exports.alluser = async (req, res) => {
  try {
    const students = await User.find({
      teacher: req.teacher._id,
      role: "student",
      isDeleted: false,
    })
      .populate("batch")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      students: students.map((student) => sanitizeStudent(student)),
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

exports.oneuser = async (req, res) => {
  try {
    const student = await User.findOne({
      _id: req.params.id,
      teacher: req.teacher._id,
      role: "student",
      isDeleted: false,
    }).populate("batch");

    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }

    return res.status(200).json({ student: sanitizeStudent(student) });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

exports.updateUser = async (req, res) => {
  try {
    const { batch: batchId } = req.body;
    const existingStudent = await User.findOne({
      _id: req.params.id,
      teacher: req.teacher._id,
      role: "student",
      isDeleted: false,
    });

    if (!existingStudent) {
      return res.status(404).json({ message: "Student not found" });
    }

    if (batchId && String(batchId) !== String(existingStudent.batch)) {
      const newBatch = await Batch.findOne({
        _id: batchId,
        teacher: req.teacher._id,
        isDeleted: false,
      });

      if (!newBatch) {
        return res.status(404).json({ message: "New batch not found" });
      }

      await Batch.findByIdAndUpdate(existingStudent.batch, {
        $pull: { students: existingStudent._id },
      });

      await Batch.findByIdAndUpdate(batchId, {
        $addToSet: { students: existingStudent._id },
      });
    }

    if (req.body.password) {
      req.body.password = await bcrypt.hash(req.body.password, 10);
    }

    const updatedStudent = await User.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    }).populate("batch");

    return res.status(200).json({
      message: "Student updated successfully",
      student: sanitizeStudent(updatedStudent),
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

exports.softDeleteUser = async (req, res) => {
  try {
    const student = await User.findOneAndUpdate(
      {
        _id: req.params.id,
        teacher: req.teacher._id,
        role: "student",
        isDeleted: false,
      },
      {
        isDeleted: true,
        isActive: false,
        deletedAt: new Date(),
      },
      { new: true }
    );

    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }

    await Batch.findByIdAndUpdate(student.batch, {
      $pull: { students: student._id },
    });

    return res.status(200).json({ message: "Student soft deleted successfully" });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};
