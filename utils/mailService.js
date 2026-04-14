const nodemailer = require("nodemailer");

let transporter;

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
