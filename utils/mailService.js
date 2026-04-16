const nodemailer = require("nodemailer");

let transporter;

const escapeHtml = (value = "") =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const getTransporter = () => {
  if (transporter) {
    return transporter;
  }

  transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.SENT_EMAIL,
      pass: process.env.SENT_PASS,
    },
  });

  return transporter;
};

exports.sendLoginNotification = async ({ email, name, role }) => {
  if (!process.env.SENT_EMAIL || !process.env.SENT_PASS || !email) {
    return;
  }

  const mailer = getTransporter();

  await mailer.sendMail({
    from: process.env.SENT_EMAIL,
    to: email,
    subject: "Quiz App Login Alert",
    text: `Hello ${name || "User"}, your ${role} account has logged into the Quiz App successfully.`,
  });
};

exports.sendPasswordResetOtp = async ({ email, name, otp }) => {
  if (!process.env.SENT_EMAIL || !process.env.SENT_PASS || !email || !otp) {
    return;
  }

  const mailer = getTransporter();

  await mailer.sendMail({
    from: process.env.SENT_EMAIL,
    to: email,
    subject: "Quiz App Password Reset OTP",
    text: `Hello ${name || "User"}, your Quiz App password reset OTP is ${otp}. It expires in 10 minutes.`,
  });
};

exports.sendStudentWelcomeMail = async ({ student, plainPassword }) => {
  if (!process.env.SENT_EMAIL || !process.env.SENT_PASS || !student?.email) {
    return false;
  }

  const mailer = getTransporter();
  const batchName = student.batch?.batchName || "Not assigned";
  const batchCode = student.batch?.batchCode || "N/A";
  const teacherName = student.teacher?.name || "Your teacher";
  const teacherEmail = student.teacher?.email || "N/A";
  const loginPassword = plainPassword || "Use the password shared by your teacher.";
  const htmlFields = {
    name: escapeHtml(student.name || "N/A"),
    email: escapeHtml(student.email),
    enrollmentNumber: escapeHtml(student.enrollmentNumber || "N/A"),
    batchName: escapeHtml(batchName),
    batchCode: escapeHtml(batchCode),
    teacherName: escapeHtml(teacherName),
    teacherEmail: escapeHtml(teacherEmail),
    loginPassword: escapeHtml(loginPassword),
  };

  await mailer.sendMail({
    from: process.env.SENT_EMAIL,
    to: student.email,
    subject: "Welcome to Quiz App - Student Account Created",
    text: [
      `Hello ${student.name || "Student"},`,
      "",
      "Your student account has been created successfully.",
      "",
      "Account details:",
      `Name: ${student.name || "N/A"}`,
      `Email: ${student.email}`,
      `Enrollment Number: ${student.enrollmentNumber || "N/A"}`,
      `Batch: ${batchName}`,
      `Batch Code: ${batchCode}`,
      `Teacher: ${teacherName}`,
      `Teacher Email: ${teacherEmail}`,
      `Password: ${loginPassword}`,
      "",
      "Please keep your login details safe.",
      "",
      "Regards,",
      "Quiz App Team",
    ].join("\n"),
    html: `
      <div style="font-family: Arial, sans-serif; color: #1f2937; line-height: 1.6;">
        <h2 style="color: #111827;">Welcome to Quiz App</h2>
        <p>Hello ${htmlFields.name},</p>
        <p>Your student account has been created successfully.</p>
        <table style="border-collapse: collapse; width: 100%; max-width: 560px;">
          <tbody>
            <tr><td style="padding: 8px; border: 1px solid #e5e7eb;"><strong>Name</strong></td><td style="padding: 8px; border: 1px solid #e5e7eb;">${htmlFields.name}</td></tr>
            <tr><td style="padding: 8px; border: 1px solid #e5e7eb;"><strong>Email</strong></td><td style="padding: 8px; border: 1px solid #e5e7eb;">${htmlFields.email}</td></tr>
            <tr><td style="padding: 8px; border: 1px solid #e5e7eb;"><strong>Enrollment Number</strong></td><td style="padding: 8px; border: 1px solid #e5e7eb;">${htmlFields.enrollmentNumber}</td></tr>
            <tr><td style="padding: 8px; border: 1px solid #e5e7eb;"><strong>Batch</strong></td><td style="padding: 8px; border: 1px solid #e5e7eb;">${htmlFields.batchName}</td></tr>
            <tr><td style="padding: 8px; border: 1px solid #e5e7eb;"><strong>Batch Code</strong></td><td style="padding: 8px; border: 1px solid #e5e7eb;">${htmlFields.batchCode}</td></tr>
            <tr><td style="padding: 8px; border: 1px solid #e5e7eb;"><strong>Teacher</strong></td><td style="padding: 8px; border: 1px solid #e5e7eb;">${htmlFields.teacherName}</td></tr>
            <tr><td style="padding: 8px; border: 1px solid #e5e7eb;"><strong>Teacher Email</strong></td><td style="padding: 8px; border: 1px solid #e5e7eb;">${htmlFields.teacherEmail}</td></tr>
            <tr><td style="padding: 8px; border: 1px solid #e5e7eb;"><strong>Password</strong></td><td style="padding: 8px; border: 1px solid #e5e7eb;">${htmlFields.loginPassword}</td></tr>
          </tbody>
        </table>
        <p>Please keep your login details safe.</p>
        <p>Regards,<br/>Quiz App Team</p>
      </div>
    `,
  });

  return true;
};
