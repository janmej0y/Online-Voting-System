import nodemailer from "nodemailer";

type MailPayload = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

function getMailConfig() {
  return {
    host: process.env.SMTP_HOST || "",
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === "true",
    user: process.env.SMTP_USER || "",
    pass: process.env.SMTP_PASS || "",
    from: process.env.MAIL_FROM || process.env.SMTP_USER || ""
  };
}

export function isMailConfigured() {
  const config = getMailConfig();
  return Boolean(config.host && config.port && config.user && config.pass && config.from);
}

async function getTransporter() {
  const config = getMailConfig();
  return nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: {
      user: config.user,
      pass: config.pass
    }
  });
}

export async function sendMail(payload: MailPayload) {
  if (!isMailConfigured()) return { sent: false, reason: "mail_not_configured" as const };

  const transporter = await getTransporter();
  const config = getMailConfig();

  await transporter.sendMail({
    from: config.from,
    to: payload.to,
    subject: payload.subject,
    text: payload.text,
    html: payload.html
  });

  return { sent: true as const };
}

export async function sendVerificationPendingAdminEmail({
  adminEmail,
  voterEmail,
  voterName,
  constituencyId
}: {
  adminEmail: string;
  voterEmail: string;
  voterName: string;
  constituencyId?: string;
}) {
  return sendMail({
    to: adminEmail,
    subject: "New voter verification submitted",
    text: [
      "A voter has completed profile verification and is pending review.",
      `Name: ${voterName || "Not provided"}`,
      `Email: ${voterEmail}`,
      `Constituency: ${constituencyId || "Not assigned"}`,
      "",
      "Review this voter in the EzeeVote admin panel."
    ].join("\n")
  });
}

export async function sendVoterApprovedEmail({
  voterEmail,
  voterName,
  constituencyId
}: {
  voterEmail: string;
  voterName: string;
  constituencyId?: string;
}) {
  return sendMail({
    to: voterEmail,
    subject: "Your voter verification has been approved",
    text: [
      `Hello ${voterName || "voter"},`,
      "",
      "Your EzeeVote profile and verification have been approved.",
      `Constituency: ${constituencyId || "Not assigned"}`,
      "",
      "You can now return to the platform and cast your vote when the active election is open."
    ].join("\n")
  });
}

export async function sendVoterRejectedEmail({
  voterEmail,
  voterName,
  reason
}: {
  voterEmail: string;
  voterName: string;
  reason?: string;
}) {
  return sendMail({
    to: voterEmail,
    subject: "Your voter verification needs correction",
    text: [
      `Hello ${voterName || "voter"},`,
      "",
      "Your EzeeVote profile verification was reviewed and could not be approved yet.",
      `Reason: ${reason || "The review desk requested corrections to your submitted details or documents."}`,
      "",
      "Please return to the profile desk, update your information, and submit the corrected verification package."
    ].join("\n")
  });
}
