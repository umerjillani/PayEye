import sgMail from '@sendgrid/mail';

// Allow bypassing email for development
const BYPASS_EMAIL = process.env.NODE_ENV === 'development' && !process.env.SENDGRID_API_KEY;

if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

interface EmailParams {
  to: string;
  from: string;
  subject: string;
  text?: string;
  html?: string;
}

export async function sendEmail(params: EmailParams): Promise<boolean> {
  // Skip email sending in development mode if no SendGrid key
  if (BYPASS_EMAIL) {
    console.log('📧 DEVELOPMENT MODE - Email bypassed');
    console.log(`To: ${params.to}`);
    console.log(`Subject: ${params.subject}`);
    console.log(`Message: ${params.text || 'HTML content'}`);
    return true;
  }

  try {
    await sgMail.send({
      to: params.to,
      from: params.from,
      subject: params.subject,
      text: params.text,
      html: params.html,
    });
    return true;
  } catch (error) {
    console.error('SendGrid email error:', error);
    return false;
  }
}

export function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function sendOTPEmail(email: string, otp: string, userName?: string): Promise<boolean> {
  // In development mode, log the OTP to console for easy testing
  if (BYPASS_EMAIL) {
    console.log('🔐 DEVELOPMENT MODE - OTP for testing:');
    console.log(`Email: ${email}`);
    console.log(`OTP: ${otp}`);
    console.log(`User: ${userName || 'Unknown'}`);
    console.log('Use this OTP to verify your email during testing');
    return true;
  }
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>PayEYE - Email Verification</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #2563eb; color: white; padding: 20px; text-align: center; }
        .content { padding: 30px; background: #f8f9fa; }
        .otp-box { background: white; border: 2px solid #2563eb; padding: 20px; text-align: center; margin: 20px 0; border-radius: 8px; }
        .otp-code { font-size: 32px; font-weight: bold; color: #2563eb; letter-spacing: 8px; }
        .footer { text-align: center; padding: 20px; color: #666; font-size: 14px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>PayEYE</h1>
          <p>Payroll Management System</p>
        </div>
        <div class="content">
          <h2>Email Verification Required</h2>
          <p>Hello${userName ? ` ${userName}` : ''},</p>
          <p>Thank you for signing up with PayEYE. To complete your registration, please verify your email address using the verification code below:</p>
          
          <div class="otp-box">
            <p><strong>Your Verification Code:</strong></p>
            <div class="otp-code">${otp}</div>
          </div>
          
          <p><strong>Important:</strong></p>
          <ul>
            <li>This code will expire in 15 minutes</li>
            <li>Enter this code in the verification screen</li>
            <li>Do not share this code with anyone</li>
          </ul>
          
          <p>If you didn't create an account with PayEYE, please ignore this email.</p>
          
          <p>Best regards,<br>The PayEYE Team</p>
        </div>
        <div class="footer">
          <p>This is an automated message. Please do not reply to this email.</p>
          <p>&copy; 2025 PayEYE. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const text = `
PayEYE - Email Verification

Hello${userName ? ` ${userName}` : ''},

Thank you for signing up with PayEYE. Your verification code is: ${otp}

This code will expire in 15 minutes. Enter this code in the verification screen to complete your registration.

If you didn't create an account with PayEYE, please ignore this email.

Best regards,
The PayEYE Team
  `;

  return await sendEmail({
    to: email,
    from: 'noreply@payeye.app', // You may need to configure this domain in SendGrid
    subject: 'PayEYE - Verify Your Email Address',
    text,
    html,
  });
}