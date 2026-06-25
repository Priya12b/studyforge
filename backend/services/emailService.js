/**
 * Email Service — Nodemailer + Gmail SMTP
 * Handles Study Buddy invitation emails.
 */

const nodemailer = require("nodemailer");

// Create a reusable transporter instance
const createTransporter = () => {
  return nodemailer.createTransport({
    // Port 465 (SMTPS) is blocked by Render's firewall.
    // Use port 587 with STARTTLS — this is what Render allows for outbound SMTP.
    host: "smtp.gmail.com",
    port: 587,
    secure: false,            // false = STARTTLS upgrade (not immediate TLS)
    requireTLS: true,         // enforce TLS upgrade; fail if server doesn't support it
    family: 4,                // force IPv4 — Render blocks IPv6 outbound
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
    // Prevent silent hangs on cloud platforms (Render, Railway, etc.)
    connectionTimeout: 10000,  // 10 s to connect
    greetingTimeout: 5000,     // 5 s for SMTP greeting
    socketTimeout: 15000,      // 15 s for each send operation
  });
};

/**
 * Send a Study Buddy invitation email.
 * @param {Object} opts
 * @param {string} opts.senderName   - Name of the student sending the invite
 * @param {string} opts.senderEmail  - Email of the sender (shown in body)
 * @param {string} opts.recipientEmail - Email of the buddy to invite
 * @param {string} opts.recipientName  - Name of the buddy
 * @param {string[]} opts.sharedSubjects - Subjects both students share
 * @param {string[]} opts.senderStrong  - Topics sender is strong in (can teach buddy)
 * @param {number}  opts.matchScore    - Compatibility percentage
 */
const sendBuddyInvitation = async ({
  senderName,
  senderEmail,
  recipientEmail,
  recipientName,
  sharedSubjects = [],
  senderStrong = [],
  matchScore = 0,
}) => {
  const transporter = createTransporter();

  const sharedSubjectsText =
    sharedSubjects.length > 0
      ? `<strong>${sharedSubjects.join(", ")}</strong>`
      : "similar topics";

  const teachText =
    senderStrong.length > 0
      ? `<p style="color:#6d28d9; margin:0 0 8px 0;">✨ <strong>${senderName}</strong> can help you with: <strong>${senderStrong.join(", ")}</strong></p>`
      : "";

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Study Buddy Invitation</title>
</head>
<body style="margin:0; padding:0; background:#f5f7fb; font-family:'Segoe UI', Arial, sans-serif;">
  <table cellpadding="0" cellspacing="0" width="100%" style="padding:40px 20px;">
    <tr>
      <td align="center">
        <table cellpadding="0" cellspacing="0" width="560" style="background:#fff; border-radius:24px; overflow:hidden; box-shadow:0 20px 60px rgba(15,23,42,0.12);">

          <!-- Header accent bar -->
          <tr>
            <td style="height:6px; background:linear-gradient(90deg,#7c3aed,#06b6d4);"></td>
          </tr>

          <!-- Logo / Brand -->
          <tr>
            <td align="center" style="padding:32px 40px 0;">
              <div style="display:inline-flex; align-items:center; gap:10px;">
                <div style="width:44px;height:44px;border-radius:14px;background:linear-gradient(135deg,#7c3aed,#06b6d4);display:flex;align-items:center;justify-content:center;font-weight:800;color:#fff;font-size:1.1rem;">SF</div>
                <span style="font-size:1.5rem;font-weight:800;color:#0f172a;letter-spacing:-0.03em;">StudyForge</span>
              </div>
            </td>
          </tr>

          <!-- Headline -->
          <tr>
            <td align="center" style="padding:28px 40px 0;">
              <div style="font-size:2rem;">🤝</div>
              <h1 style="margin:12px 0 6px;font-size:1.65rem;font-weight:800;color:#0f172a;letter-spacing:-0.02em;">You have a Study Buddy invite!</h1>
              <p style="margin:0;color:#64748b;font-size:1rem;">
                <strong style="color:#7c3aed;">${senderName}</strong> thinks you two would make a great study team.
              </p>
            </td>
          </tr>

          <!-- Match Score Badge -->
          <tr>
            <td align="center" style="padding:24px 40px 0;">
              <div style="display:inline-block;background:linear-gradient(135deg,#7c3aed,#06b6d4);color:#fff;padding:12px 28px;border-radius:999px;font-size:1.1rem;font-weight:800;">
                ${matchScore}% Compatibility Match 🎯
              </div>
            </td>
          </tr>

          <!-- Details Box -->
          <tr>
            <td style="padding:24px 40px;">
              <div style="background:#f8faff;border:1px solid #e2e8f0;border-radius:16px;padding:24px;">
                <p style="margin:0 0 12px 0;font-weight:700;font-size:1rem;color:#0f172a;">Why you're a great match:</p>
                <p style="color:#475569;margin:0 0 8px 0;">📚 Shared subjects: ${sharedSubjectsText}</p>
                ${teachText}
                <p style="color:#64748b;margin:0;font-size:0.9rem;">
                  Reply to this email or use their contact below to connect.
                </p>
              </div>
            </td>
          </tr>

          <!-- Sender Contact -->
          <tr>
            <td style="padding:0 40px 16px;">
              <div style="background:linear-gradient(135deg,rgba(124,58,237,0.08),rgba(6,182,212,0.08));border:1px solid rgba(124,58,237,0.15);border-radius:16px;padding:20px;">
                <p style="margin:0 0 6px;color:#7c3aed;font-size:0.8rem;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;">Invitation from</p>
                <p style="margin:0;font-size:1.1rem;font-weight:700;color:#0f172a;">${senderName}</p>
                <p style="margin:4px 0 0;color:#475569;font-size:0.95rem;">${senderEmail}</p>
              </div>
            </td>
          </tr>

          <!-- CTA Button -->
          <tr>
            <td align="center" style="padding:8px 40px 32px;">
              <a href="mailto:${senderEmail}?subject=Re: StudyForge Study Buddy Invitation"
                 style="display:inline-block;background:linear-gradient(135deg,#7c3aed,#06b6d4);color:#fff;text-decoration:none;padding:14px 36px;border-radius:14px;font-weight:700;font-size:1rem;letter-spacing:-0.01em;">
                Reply to ${senderName} →
              </a>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:20px 40px 32px;border-top:1px solid #f1f5f9;" align="center">
              <p style="margin:0;color:#94a3b8;font-size:0.82rem;">
                This invitation was sent via <strong>StudyForge AI Planner</strong>.<br/>
                If you did not expect this, you can safely ignore this email.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

  const mailOptions = {
    from: `"StudyForge — ${senderName}" <${process.env.GMAIL_USER}>`,
    to: recipientEmail,
    subject: `🤝 ${senderName} wants to be your Study Buddy on StudyForge!`,
    html,
    replyTo: senderEmail,
  };

  const info = await transporter.sendMail(mailOptions);
  console.log(`[EmailService] Buddy invitation sent to ${recipientEmail}: ${info.messageId}`);
  return info;
};

module.exports = { sendBuddyInvitation };
