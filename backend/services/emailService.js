const nodemailer = require('nodemailer');
const handlebars = require('handlebars');
const fs = require('fs');
const path = require('path');
const { createLogger } = require('../utils/logger');

const logger = createLogger('email-service');

class EmailService {
  constructor() {
    this.transporter = null;
    this.initialized = false;
    this.init();
  }

  init() {
    try {
      // Create transporter with Titan email configuration (based on official script)
      this.transporter = nodemailer.createTransport({
        host: process.env.EMAIL_HOST,
        port: parseInt(process.env.EMAIL_PORT),
        secure: false, // Use STARTTLS
        auth: {
          user: process.env.EMAIL_HOST_USER,
          pass: process.env.EMAIL_HOST_PASSWORD,
        },
        // Anti-spam configuration
        pool: true, // Use connection pooling
        maxConnections: 5,
        maxMessages: 100,
        rateLimit: 14, // Limit to 14 emails per second
        // Additional headers for better deliverability
        headers: {
          'X-Mailer': ' NexaBit Mail System',
          'X-Priority': '3',
          'Importance': 'Normal'
        }
      });

      this.initialized = true;
      logger.info('✅ Email transporter created successfully with anti-spam configuration');
      
      // Verify connection in background
      this.verifyConnection();
    } catch (error) {
      logger.error('❌ Email service initialization failed:', error);
      // Don't throw error, just log it - app should continue working without email
    }
  }

  async verifyConnection() {
    try {
      if (this.transporter) {
        await this.transporter.verify();
        logger.info('✅ Email connection verified successfully');
      }
    } catch (error) {
      logger.error('❌ Email connection verification failed:', error);
    }
  }

  /**
   * Generate proper email headers to avoid spam folder
   */
  generateProperHeaders(subject, emailType = 'transactional') {
    // Minimal headers - too many custom headers can trigger spam filters
    const headers = {
      'From': `" NexaBit" <${process.env.EMAIL_HOST_USER}>`,
      'Reply-To': process.env.EMAIL_HOST_USER
    };

    // Only add priority for security emails
    if (emailType === 'password-reset' || emailType === 'security') {
      headers['X-Priority'] = '1';
      headers['Importance'] = 'High';
    }

    return headers;
  }

  /**
   * Load and compile email template
   */
  loadTemplate(templateName, data) {
    try {
      const templatePath = path.join(__dirname, '../templates/emails', `${templateName}.hbs`);
      
      if (!fs.existsSync(templatePath)) {
        // Return basic template if file doesn't exist
        return this.getBasicTemplate(templateName, data);
      }

      const templateSource = fs.readFileSync(templatePath, 'utf8');
      const template = handlebars.compile(templateSource);
      return template(data);
    } catch (error) {
      logger.error('Error loading email template:', error);
      return this.getBasicTemplate(templateName, data);
    }
  }

  /**
   * Basic email templates as fallback
   */
  getBasicTemplate(templateName, data) {
    const templates = {
      welcome: `
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 20px 0;">
          <tr>
            <td align="center">
              <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border: 1px solid #e0e0e0;">
                <tr>
                  <td style="padding: 30px; text-align: center; background-color: #ffffff; border-bottom: 3px solid #000000;">
                    <h1 style="margin: 0; font-size: 24px; color: #000000; font-weight: normal;">Welcome to  NexaBit</h1>
                    <p style="margin: 10px 0 0 0; font-size: 14px; color: #666666;">Your account is ready</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 40px 30px;">
                    <p style="font-size: 16px; color: #333333; margin: 0 0 20px 0;">Hello ${data.firstName || 'User'},</p>
                    <p style="font-size: 14px; line-height: 1.6; color: #333333; margin: 0 0 20px 0;">
                      Thank you for joining  NexaBit. Your account has been successfully created and is ready to use.
                    </p>
                    <table width="100%" cellpadding="0" cellspacing="0" style="margin: 20px 0; background-color: #f9f9f9; border: 1px solid #e0e0e0;">
                      <tr>
                        <td style="padding: 20px;">
                          <p style="margin: 0 0 10px 0; font-size: 14px; color: #333333;"><strong>Email:</strong> ${data.email}</p>
                          <p style="margin: 0 0 10px 0; font-size: 14px; color: #333333;"><strong>Registration Date:</strong> ${data.registrationDate}</p>
                          <p style="margin: 0; font-size: 14px; color: #333333;"><strong>Your Referral Code:</strong> ${data.referralCode}</p>
                        </td>
                      </tr>
                    </table>
                    <p style="font-size: 14px; line-height: 1.6; color: #333333; margin: 20px 0;">
                      You can now start trading and earn through our referral program.
                    </p>
                    <table width="100%" cellpadding="0" cellspacing="0" style="margin: 30px 0;">
                      <tr>
                        <td align="center">
                          <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}" style="display: inline-block; padding: 12px 30px; background-color: #000000; color: #ffffff; text-decoration: none; font-size: 14px;">Start Trading</a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 20px 30px; text-align: center; background-color: #f9f9f9; border-top: 1px solid #e0e0e0;">
                    <p style="font-size: 12px; color: #999999; margin: 0;">
                       NexaBit<br>
                      This is an automated message. Please do not reply to this email.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      `,
      
      vip_upgrade: `
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 20px 0;">
          <tr>
            <td align="center">
              <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border: 1px solid #e0e0e0;">
                <tr>
                  <td style="padding: 30px; text-align: center; background-color: #ffffff; border-bottom: 3px solid #000000;">
                    <h1 style="margin: 0; font-size: 24px; color: #000000; font-weight: normal;">VIP Level Upgrade</h1>
                    <p style="margin: 10px 0 0 0; font-size: 14px; color: #666666;">Congratulations on your achievement</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 40px 30px;">
                    <p style="font-size: 16px; color: #333333; margin: 0 0 20px 0;">Congratulations ${data.firstName || 'User'},</p>
                    <p style="font-size: 14px; line-height: 1.6; color: #333333; margin: 0 0 20px 0;">
                      You have been upgraded to VIP Level ${data.newLevel}. Your upgrade bonus has been automatically credited to your account.
                    </p>
                    <table width="100%" cellpadding="0" cellspacing="0" style="margin: 20px 0; background-color: #f9f9f9; border: 1px solid #e0e0e0;">
                      <tr>
                        <td style="padding: 20px;">
                          <p style="margin: 0 0 10px 0; font-size: 14px; color: #333333;"><strong>Previous Level:</strong> ${data.oldLevel}</p>
                          <p style="margin: 0 0 10px 0; font-size: 14px; color: #333333;"><strong>New Level:</strong> ${data.newLevel}</p>
                          <p style="margin: 0 0 10px 0; font-size: 14px; color: #333333;"><strong>Upgrade Bonus:</strong> $${data.upgradeReward} USDT</p>
                          <p style="margin: 0; font-size: 14px; color: #333333;"><strong>Daily Reward:</strong> $${data.dailyReward} USDT</p>
                        </td>
                      </tr>
                    </table>
                    <p style="font-size: 14px; line-height: 1.6; color: #333333; margin: 20px 0;">
                      Your new daily reward is now available. Continue growing your network to unlock even higher VIP levels.
                    </p>
                    <table width="100%" cellpadding="0" cellspacing="0" style="margin: 30px 0;">
                      <tr>
                        <td align="center">
                          <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/rewards" style="display: inline-block; padding: 12px 30px; background-color: #000000; color: #ffffff; text-decoration: none; font-size: 14px;">View VIP Dashboard</a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 20px 30px; text-align: center; background-color: #f9f9f9; border-top: 1px solid #e0e0e0;">
                    <p style="font-size: 12px; color: #999999; margin: 0;">
                       NexaBit<br>
                      This is an automated message. Please do not reply to this email.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      `,

      daily_reward_reminder: `
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 20px 0;">
          <tr>
            <td align="center">
              <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border: 1px solid #e0e0e0;">
                <tr>
                  <td style="padding: 30px; text-align: center; background-color: #ffffff; border-bottom: 3px solid #000000;">
                    <h1 style="margin: 0; font-size: 24px; color: #000000; font-weight: normal;">Daily Reward Available</h1>
                    <p style="margin: 10px 0 0 0; font-size: 14px; color: #666666;">Your VIP reward is ready</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 40px 30px;">
                    <p style="font-size: 16px; color: #333333; margin: 0 0 20px 0;">Hello ${data.firstName || 'User'},</p>
                    <p style="font-size: 14px; line-height: 1.6; color: #333333; margin: 0 0 20px 0;">
                      Your VIP Level ${data.vipLevel} daily reward of $${data.dailyReward} USDT is ready to claim.
                    </p>
                    <table width="100%" cellpadding="0" cellspacing="0" style="margin: 30px 0;">
                      <tr>
                        <td align="center">
                          <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/rewards" style="display: inline-block; padding: 12px 30px; background-color: #000000; color: #ffffff; text-decoration: none; font-size: 14px;">Claim Now</a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 20px 30px; text-align: center; background-color: #f9f9f9; border-top: 1px solid #e0e0e0;">
                    <p style="font-size: 12px; color: #999999; margin: 0;">
                       NexaBit<br>
                      This is an automated message. Please do not reply to this email.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      `,

      password_reset: `
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 20px 0;">
          <tr>
            <td align="center">
              <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border: 1px solid #e0e0e0;">
                <tr>
                  <td style="padding: 30px; text-align: center; background-color: #ffffff; border-bottom: 3px solid #000000;">
                    <h1 style="margin: 0; font-size: 24px; color: #000000; font-weight: normal;">Password Reset Request</h1>
                    <p style="margin: 10px 0 0 0; font-size: 14px; color: #666666;">Reset your password</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 40px 30px;">
                    <p style="font-size: 16px; color: #333333; margin: 0 0 20px 0;">Hello ${data.firstName || 'User'},</p>
                    <p style="font-size: 14px; line-height: 1.6; color: #333333; margin: 0 0 20px 0;">
                      We received a request to reset your password. Click the button below to reset it:
                    </p>
                    <table width="100%" cellpadding="0" cellspacing="0" style="margin: 30px 0;">
                      <tr>
                        <td align="center">
                          <a href="${data.resetLink}" style="display: inline-block; padding: 12px 30px; background-color: #000000; color: #ffffff; text-decoration: none; font-size: 14px;">Reset Password</a>
                        </td>
                      </tr>
                    </table>
                    <p style="font-size: 13px; color: #666666; margin: 20px 0; padding: 15px; background-color: #f9f9f9; border-left: 3px solid #000000;">
                      This link will expire in 1 hour. If you did not request this, please ignore this email.<br><br>
                      Reset Code: <strong>${data.resetCode}</strong>
                    </p>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 20px 30px; text-align: center; background-color: #f9f9f9; border-top: 1px solid #e0e0e0;">
                    <p style="font-size: 12px; color: #999999; margin: 0;">
                       NexaBit Security<br>
                      This is an automated message. Please do not reply to this email.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      `,

      signup_otp: `
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 20px 0;">
          <tr>
            <td align="center">
              <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border: 1px solid #e0e0e0;">
                <tr>
                  <td style="padding: 30px; text-align: center; background-color: #ffffff; border-bottom: 3px solid #000000;">
                    <h1 style="margin: 0; font-size: 24px; color: #000000; font-weight: normal;"> NexaBit</h1>
                    <p style="margin: 10px 0 0 0; font-size: 16px; color: #666666;">Account Verification</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 40px 30px;">
                    <p style="font-size: 16px; color: #333333; margin: 0 0 20px 0;">Hello ${data.username || 'User'},</p>
                    <p style="font-size: 14px; line-height: 1.6; color: #333333; margin: 0 0 20px 0;">
                      Thank you for signing up with  NexaBit. Please use the verification code below to complete your registration:
                    </p>
                    <table width="100%" cellpadding="0" cellspacing="0" style="margin: 30px 0;">
                      <tr>
                        <td style="padding: 20px; text-align: center; background-color: #f9f9f9; border: 2px solid #000000;">
                          <p style="margin: 0 0 10px 0; font-size: 14px; color: #666666;">Your verification code:</p>
                          <p style="margin: 0; font-size: 32px; font-weight: bold; color: #000000; letter-spacing: 5px; font-family: monospace;">
                            ${data.otp}
                          </p>
                        </td>
                      </tr>
                    </table>
                    <p style="font-size: 13px; color: #666666; margin: 20px 0; padding: 15px; background-color: #f9f9f9; border-left: 3px solid #000000;">
                      This code will expire in ${data.expiresIn}. For security reasons, do not share this code with anyone.
                    </p>
                    <p style="font-size: 13px; color: #999999; margin: 20px 0 0 0;">
                      If you did not request this verification code, please ignore this email.
                    </p>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 20px 30px; text-align: center; background-color: #f9f9f9; border-top: 1px solid #e0e0e0;">
                    <p style="font-size: 12px; color: #999999; margin: 0;">
                       NexaBit<br>
                      This is an automated message. Please do not reply to this email.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      `,

      deposit_confirmation: `
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 20px 0;">
          <tr>
            <td align="center">
              <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border: 1px solid #e0e0e0;">
                <tr>
                  <td style="padding: 30px; text-align: center; background-color: #ffffff; border-bottom: 3px solid #000000;">
                    <h1 style="margin: 0; font-size: 24px; color: #000000; font-weight: normal;">Deposit Confirmed</h1>
                    <p style="margin: 10px 0 0 0; font-size: 14px; color: #666666;">Transaction successful</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 40px 30px;">
                    <p style="font-size: 16px; color: #333333; margin: 0 0 20px 0;">Hello ${data.firstName || 'User'},</p>
                    <p style="font-size: 14px; line-height: 1.6; color: #333333; margin: 0 0 20px 0;">
                      Your deposit has been successfully processed and credited to your account.
                    </p>
                    <table width="100%" cellpadding="0" cellspacing="0" style="margin: 20px 0; background-color: #f9f9f9; border: 1px solid #e0e0e0;">
                      <tr>
                        <td style="padding: 20px;">
                          <p style="margin: 0 0 10px 0; font-size: 14px; color: #333333;"><strong>Amount:</strong> ${data.amount} ${data.currency}</p>
                          <p style="margin: 0 0 10px 0; font-size: 14px; color: #333333;"><strong>Transaction ID:</strong> ${data.transactionId}</p>
                          <p style="margin: 0; font-size: 14px; color: #333333;"><strong>Date:</strong> ${data.date}</p>
                        </td>
                      </tr>
                    </table>
                    <table width="100%" cellpadding="0" cellspacing="0" style="margin: 30px 0;">
                      <tr>
                        <td align="center">
                          <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/assets" style="display: inline-block; padding: 12px 30px; background-color: #000000; color: #ffffff; text-decoration: none; font-size: 14px;">View Balance</a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 20px 30px; text-align: center; background-color: #f9f9f9; border-top: 1px solid #e0e0e0;">
                    <p style="font-size: 12px; color: #999999; margin: 0;">
                       NexaBit<br>
                      This is an automated message. Please do not reply to this email.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      `
    };

    return templates[templateName] || templates.welcome;
  }

  /**
   * Send welcome email on signup
   */
  async sendWelcomeEmail(userEmail, userData) {
    try {
      if (!this.transporter) {
        logger.warn('Email transporter not available');
        return { success: false, error: 'Email service not available' };
      }

      const emailData = {
        firstName: userData.firstName,
        lastName: userData.lastName,
        email: userEmail,
        referralCode: userData.referralCode,
        registrationDate: new Date().toLocaleDateString()
      };

      const htmlContent = this.loadTemplate('welcome', emailData);
      const headers = this.generateProperHeaders('Welcome to  NexaBit', 'welcome');

      const mailOptions = {
        from: headers.From,
        to: userEmail,
        subject: 'Welcome to  NexaBit',
        html: htmlContent,
        replyTo: headers['Reply-To']
      };

      const result = await this.transporter.sendMail(mailOptions);
      logger.info(`✅ Welcome email sent to ${userEmail}`);
      
      return { success: true, messageId: result.messageId };
    } catch (error) {
      logger.error('❌ Error sending welcome email:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send VIP upgrade notification email
   */
  async sendVIPUpgradeEmail(userEmail, upgradeData) {
    try {
      if (!this.transporter) {
        logger.warn('Email transporter not available');
        return { success: false, error: 'Email service not available' };
      }

      const emailData = {
        firstName: upgradeData.firstName,
        oldLevel: upgradeData.oldLevel,
        newLevel: upgradeData.newLevel,
        upgradeReward: upgradeData.upgradeReward,
        dailyReward: upgradeData.dailyReward
      };

      const htmlContent = this.loadTemplate('vip_upgrade', emailData);
      const headers = this.generateProperHeaders(`VIP Level ${upgradeData.newLevel} Upgrade`, 'vip');

      const mailOptions = {
        from: headers.From,
        to: userEmail,
        subject: `VIP Level ${upgradeData.newLevel} Upgrade`,
        html: htmlContent,
        replyTo: headers['Reply-To']
      };

      const result = await this.transporter.sendMail(mailOptions);
      logger.info(`✅ VIP upgrade email sent to ${userEmail}`);
      
      return { success: true, messageId: result.messageId };
    } catch (error) {
      logger.error('❌ Error sending VIP upgrade email:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send daily reward reminder email
   */
  async sendDailyRewardReminder(userEmail, rewardData) {
    try {
      if (!this.transporter) {
        logger.warn('Email transporter not available');
        return { success: false, error: 'Email service not available' };
      }

      const emailData = {
        firstName: rewardData.firstName,
        vipLevel: rewardData.vipLevel,
        dailyReward: rewardData.dailyReward
      };

      const htmlContent = this.loadTemplate('daily_reward_reminder', emailData);

      const mailOptions = {
        from: `" NexaBit Rewards" <${process.env.EMAIL_HOST_USER}>`,
        to: userEmail,
        subject: 'Your Daily VIP Reward is Ready',
        html: htmlContent
      };

      const result = await this.transporter.sendMail(mailOptions);
      logger.info(`✅ Daily reward reminder sent to ${userEmail}`);
      
      return { success: true, messageId: result.messageId };
    } catch (error) {
      logger.error('❌ Error sending daily reward reminder:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send password reset email
   */
  async sendPasswordResetEmail(userEmail, resetData) {
    try {
      if (!this.transporter) {
        logger.warn('Email transporter not available');
        return { success: false, error: 'Email service not available' };
      }

      const emailData = {
        firstName: resetData.firstName,
        resetLink: resetData.resetLink,
        resetCode: resetData.resetCode
      };

      const htmlContent = this.loadTemplate('password_reset', emailData);
      const headers = this.generateProperHeaders('Password Reset Request -  NexaBit', 'password-reset');

      const mailOptions = {
        from: headers.From,
        to: userEmail,
        subject: 'Password Reset Request -  NexaBit',
        html: htmlContent,
        replyTo: headers['Reply-To'],
        priority: 'high'
      };

      const result = await this.transporter.sendMail(mailOptions);
      logger.info(`✅ Password reset email sent to ${userEmail}`);
      
      return { success: true, messageId: result.messageId };
    } catch (error) {
      logger.error('❌ Error sending password reset email:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send OTP verification email for login
   */
  async sendOTPEmail(userEmail, otpData) {
    try {
      if (!this.transporter) {
        logger.warn('Email transporter not available');
        return { success: false, error: 'Email service not available' };
      }

      const htmlContent = `
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 20px 0;">
          <tr>
            <td align="center">
              <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border: 1px solid #e0e0e0;">
                <tr>
                  <td style="padding: 30px; text-align: center; background-color: #ffffff; border-bottom: 3px solid #000000;">
                    <h1 style="margin: 0; font-size: 24px; color: #000000; font-weight: normal;">Security Verification</h1>
                    <p style="margin: 10px 0 0 0; font-size: 14px; color: #666666;">Login verification</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 40px 30px;">
                    <p style="font-size: 16px; color: #333333; margin: 0 0 20px 0;">Hello ${otpData.firstName || 'User'},</p>
                    <p style="font-size: 14px; line-height: 1.6; color: #333333; margin: 0 0 20px 0;">
                      Please use the following verification code to complete your login to  NexaBit:
                    </p>
                    <table width="100%" cellpadding="0" cellspacing="0" style="margin: 30px 0;">
                      <tr>
                        <td style="padding: 20px; text-align: center; background-color: #f9f9f9; border: 2px solid #000000;">
                          <p style="margin: 0 0 10px 0; font-size: 14px; color: #666666;">Your verification code:</p>
                          <p style="margin: 0; font-size: 32px; font-weight: bold; color: #000000; letter-spacing: 5px; font-family: monospace;">
                            ${otpData.otp}
                          </p>
                        </td>
                      </tr>
                    </table>
                    <p style="font-size: 13px; color: #666666; margin: 20px 0; padding: 15px; background-color: #f9f9f9; border-left: 3px solid #000000;">
                      This code expires in ${otpData.expiresIn}. For security reasons, do not share this code with anyone.
                    </p>
                    <p style="font-size: 13px; color: #999999; margin: 20px 0 0 0;">
                      If you did not request this verification code, please ignore this email or contact our support team.
                    </p>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 20px 30px; text-align: center; background-color: #f9f9f9; border-top: 1px solid #e0e0e0;">
                    <p style="font-size: 12px; color: #999999; margin: 0;">
                       NexaBit Security<br>
                      This is an automated message. Please do not reply to this email.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      `;

      const headers = this.generateProperHeaders(' NexaBit - Login Verification Code', 'security');

      const mailOptions = {
        from: headers.From,
        to: userEmail,
        subject: ' NexaBit - Login Verification Code',
        html: htmlContent,
        replyTo: headers['Reply-To'],
        priority: 'high'
      };

      const result = await this.transporter.sendMail(mailOptions);
      logger.info(`✅ OTP email sent to ${userEmail}`);
      
      return { success: true, messageId: result.messageId };
    } catch (error) {
      logger.error('❌ Error sending OTP email:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send OTP verification email for withdrawal password operations
   */
  async sendWithdrawalPasswordOTPEmail(userEmail, otpData) {
    try {
      if (!this.transporter) {
        logger.warn('Email transporter not available');
        return { success: false, error: 'Email service not available' };
      }

      const isCreation = otpData.isCreation !== false;
      const actionText = isCreation ? 'create your withdrawal password' : 'change your withdrawal password';
      const subjectText = isCreation ? 'Create Withdrawal Password' : 'Change Withdrawal Password';

      const htmlContent = `
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 20px 0;">
          <tr>
            <td align="center">
              <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border: 1px solid #e0e0e0;">
                <tr>
                  <td style="padding: 30px; text-align: center; background-color: #ffffff; border-bottom: 3px solid #000000;">
                    <h1 style="margin: 0; font-size: 24px; color: #000000; font-weight: normal;">Withdrawal Security</h1>
                    <p style="margin: 10px 0 0 0; font-size: 14px; color: #666666;">${subjectText}</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 40px 30px;">
                    <p style="font-size: 16px; color: #333333; margin: 0 0 20px 0;">Hello ${otpData.firstName || 'User'},</p>
                    <p style="font-size: 14px; line-height: 1.6; color: #333333; margin: 0 0 20px 0;">
                      Please use the following verification code to ${actionText} on  NexaBit:
                    </p>
                    <table width="100%" cellpadding="0" cellspacing="0" style="margin: 30px 0;">
                      <tr>
                        <td style="padding: 20px; text-align: center; background-color: #f9f9f9; border: 2px solid #000000;">
                          <p style="margin: 0 0 10px 0; font-size: 14px; color: #666666;">Your verification code:</p>
                          <p style="margin: 0; font-size: 32px; font-weight: bold; color: #000000; letter-spacing: 5px; font-family: monospace;">
                            ${otpData.otp}
                          </p>
                        </td>
                      </tr>
                    </table>
                    <p style="font-size: 13px; color: #666666; margin: 20px 0; padding: 15px; background-color: #f9f9f9; border-left: 3px solid #000000;">
                      This code will expire in ${otpData.expiresIn}. This code is for withdrawal password ${isCreation ? 'creation' : 'modification'}. For security reasons, do not share this code with anyone.
                    </p>
                    <p style="font-size: 13px; color: #999999; margin: 20px 0 0 0;">
                      If you did not request this verification code, please ignore this email or contact our support team immediately.
                    </p>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 20px 30px; text-align: center; background-color: #f9f9f9; border-top: 1px solid #e0e0e0;">
                    <p style="font-size: 12px; color: #999999; margin: 0;">
                       NexaBit Security<br>
                      This is an automated message. Please do not reply to this email.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      `;

      const headers = this.generateProperHeaders(` NexaBit - ${subjectText} Verification`, 'security');

      const mailOptions = {
        from: headers.From,
        to: userEmail,
        subject: ` NexaBit - ${subjectText} Verification`,
        html: htmlContent,
        replyTo: headers['Reply-To'],
        priority: 'high'
      };

      const result = await this.transporter.sendMail(mailOptions);
      logger.info(`✅ Withdrawal password OTP email sent to ${userEmail}`);
      
      return { success: true, messageId: result.messageId };
    } catch (error) {
      logger.error('❌ Error sending withdrawal password OTP email:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send OTP verification email for signup
   */
  async sendSignupOTPEmail(userEmail, otpData) {
    try {
      if (!this.transporter) {
        logger.warn('Email transporter not available');
        return { success: false, error: 'Email service not available' };
      }

      const emailData = {
        username: otpData.username,
        otp: otpData.otp,
        expiresIn: otpData.expiresIn
      };

      const htmlContent = this.loadTemplate('signup_otp', emailData);
      const headers = this.generateProperHeaders(' NexaBit - Complete Your Account Signup', 'security');

      const mailOptions = {
        from: headers.From,
        to: userEmail,
        subject: ' NexaBit - Complete Your Account Signup',
        html: htmlContent,
        replyTo: headers['Reply-To'],
        priority: 'high'
      };

      const result = await this.transporter.sendMail(mailOptions);
      logger.info(`✅ Signup OTP email sent to ${userEmail}`);
      
      return { success: true, messageId: result.messageId };
    } catch (error) {
      logger.error('❌ Error sending signup OTP email:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send deposit confirmation email
   */
  async sendDepositConfirmationEmail(userEmail, depositData) {
    try {
      if (!this.transporter) {
        logger.warn('Email transporter not available');
        return { success: false, error: 'Email service not available' };
      }

      const emailData = {
        firstName: depositData.firstName,
        amount: depositData.amount,
        currency: depositData.currency,
        transactionId: depositData.transactionId,
        date: new Date(depositData.date).toLocaleDateString()
      };

      const htmlContent = this.loadTemplate('deposit_confirmation', emailData);

      const mailOptions = {
        from: `" NexaBit Deposits" <${process.env.EMAIL_HOST_USER}>`,
        to: userEmail,
        subject: 'Deposit Confirmation -  NexaBit',
        html: htmlContent
      };

      const result = await this.transporter.sendMail(mailOptions);
      logger.info(`✅ Deposit confirmation email sent to ${userEmail}`);
      
      return { success: true, messageId: result.messageId };
    } catch (error) {
      logger.error('❌ Error sending deposit confirmation email:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send custom email
   */
  async sendCustomEmail(to, subject, htmlContent, from = null) {
    try {
      if (!this.transporter) {
        logger.warn('Email transporter not available');
        return { success: false, error: 'Email service not available' };
      }

      const mailOptions = {
        from: from || `" NexaBit" <${process.env.EMAIL_HOST_USER}>`,
        to: to,
        subject: subject,
        html: htmlContent
      };

      const result = await this.transporter.sendMail(mailOptions);
      logger.info(`✅ Custom email sent to ${to}`);
      
      return { success: true, messageId: result.messageId };
    } catch (error) {
      logger.error('❌ Error sending custom email:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Test email configuration
   */
  async testEmail(toEmail = null) {
    try {
      if (!this.transporter) {
        throw new Error('Email transporter not available');
      }

      const targetEmail = toEmail || process.env.EMAIL_HOST_USER;

      const testEmail = {
        from: `" NexaBit Test" <${process.env.EMAIL_HOST_USER}>`,
        to: targetEmail,
        subject: 'Email Service Test -  NexaBit',
        html: `
          <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif; background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.1);">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center;">
              <h1 style="margin: 0; font-size: 24px;">🧪 Email Service Test</h1>
              <p style="margin: 10px 0 0 0; opacity: 0.9;"> NexaBit Email System</p>
            </div>
            <div style="padding: 30px;">
              <h2 style="color: #333; margin: 0 0 20px 0;">✅ Email Service Working!</h2>
              <p style="color: #666; line-height: 1.6; margin: 0 0 20px 0;">
                This is a test email to verify that the  NexaBit email service is working correctly.
              </p>
              <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <h3 style="margin: 0 0 15px 0; color: #333;">📊 Test Details:</h3>
                <p style="margin: 5px 0; color: #555;"><strong>Timestamp:</strong> ${new Date().toISOString()}</p>
                <p style="margin: 5px 0; color: #555;"><strong>To:</strong> ${targetEmail}</p>
                <p style="margin: 5px 0; color: #555;"><strong>From:</strong> ${process.env.EMAIL_HOST_USER}</p>
                <p style="margin: 5px 0; color: #555;"><strong>Server:</strong> ${process.env.EMAIL_HOST}</p>
              </div>
              <div style="text-align: center; margin: 30px 0;">
                <a href="${process.env.NODE_ENV === 'production' ? process.env.FRONTEND_URL_PROD : process.env.FRONTEND_URL}" 
                   style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px 30px; text-decoration: none; border-radius: 25px; font-weight: bold; display: inline-block;">
                  Visit  NexaBit
                </a>
              </div>
            </div>
            <div style="background: #f8f9fa; padding: 20px; text-align: center; color: #666; font-size: 14px;">
              © 2025  NexaBit - Email Service Test
            </div>
          </div>
        `
      };

      const result = await this.transporter.sendMail(testEmail);
      logger.info(`✅ Test email sent successfully to ${targetEmail}`);
      
      return { success: true, messageId: result.messageId, sentTo: targetEmail };
    } catch (error) {
      logger.error('❌ Test email failed:', error);
      return { success: false, error: error.message };
    }
  }
}

// Create singleton instance
const emailService = new EmailService();

module.exports = emailService;
