
require('dotenv').config();
const emailService = require('./services/emailService');
const { createLogger } = require('./utils/logger');

const logger = createLogger('email-test');

/**
 * Test Email Service Configuration
 * This script tests all email functionalities and verifies the email configuration
 */

async function testEmailService() {
  // Target email address for testing
  const TEST_EMAIL = 'copena6187@keevle.com';
  
  console.log('\n🧪 Starting Email Service Test...\n');
  console.log('═══════════════════════════════════════════════════════════════');
  
  // Display email configuration
  console.log('\n📧 Email Configuration:');
  console.log('─────────────────────────────────────────────────────────────');
  console.log(`Host:     ${process.env.EMAIL_HOST}`);
  console.log(`Port:     ${process.env.EMAIL_PORT}`);
  console.log(`User:     ${process.env.EMAIL_HOST_USER}`);
  console.log(`Password: ${'*'.repeat(process.env.EMAIL_HOST_PASSWORD?.length || 0)}`);
  console.log(`Frontend: ${process.env.FRONTEND_URL}`);
  console.log(`Test To:  ${TEST_EMAIL}`);
  console.log('─────────────────────────────────────────────────────────────');

  // Check if email service is initialized
  if (!emailService.initialized) {
    console.error('\n❌ Email service not initialized!');
    console.error('Please check your email configuration in .env file');
    process.exit(1);
  }

  console.log('\n✅ Email service initialized successfully');

  // Test 1: Connection verification
  console.log('\n🔍 Test 1: Verifying email connection...');
  await emailService.verifyConnection();

  // Test 2: Send basic test email
  console.log('\n📨 Test 2: Sending basic test email...');
  const testEmailResult = await emailService.testEmail(TEST_EMAIL);
  
  if (testEmailResult.success) {
    console.log(`✅ Test email sent successfully!`);
    console.log(`   Message ID: ${testEmailResult.messageId}`);
    console.log(`   Sent to: ${testEmailResult.sentTo}`);
  } else {
    console.error(`❌ Test email failed: ${testEmailResult.error}`);
  }

  // Test 3: Welcome email template
  console.log('\n📨 Test 3: Testing welcome email template...');
  const welcomeResult = await emailService.sendWelcomeEmail(
    TEST_EMAIL,
    {
      firstName: 'Test',
      lastName: 'User',
      referralCode: 'TEST123',
    }
  );
  
  if (welcomeResult.success) {
    console.log(`✅ Welcome email sent successfully!`);
    console.log(`   Message ID: ${welcomeResult.messageId}`);
  } else {
    console.error(`❌ Welcome email failed: ${welcomeResult.error}`);
  }

  // Test 4: OTP email
  console.log('\n📨 Test 4: Testing OTP email...');
  const otpResult = await emailService.sendOTPEmail(
    TEST_EMAIL,
    {
      firstName: 'Test',
      otp: '123456',
      expiresIn: '10 minutes'
    }
  );
  
  if (otpResult.success) {
    console.log(`✅ OTP email sent successfully!`);
    console.log(`   Message ID: ${otpResult.messageId}`);
  } else {
    console.error(`❌ OTP email failed: ${otpResult.error}`);
  }

  // Test 5: VIP upgrade email
  console.log('\n📨 Test 5: Testing VIP upgrade email...');
  const vipResult = await emailService.sendVIPUpgradeEmail(
    TEST_EMAIL,
    {
      firstName: 'Test',
      oldLevel: 1,
      newLevel: 2,
      upgradeReward: 100,
      dailyReward: 10
    }
  );
  
  if (vipResult.success) {
    console.log(`✅ VIP upgrade email sent successfully!`);
    console.log(`   Message ID: ${vipResult.messageId}`);
  } else {
    console.error(`❌ VIP upgrade email failed: ${vipResult.error}`);
  }

  // Test 6: Password reset email
  console.log('\n📨 Test 6: Testing password reset email...');
  const resetResult = await emailService.sendPasswordResetEmail(
    TEST_EMAIL,
    {
      firstName: 'Test',
      resetLink: `${process.env.FRONTEND_URL}/reset-password?token=test123`,
      resetCode: 'RESET789'
    }
  );
  
  if (resetResult.success) {
    console.log(`✅ Password reset email sent successfully!`);
    console.log(`   Message ID: ${resetResult.messageId}`);
  } else {
    console.error(`❌ Password reset email failed: ${resetResult.error}`);
  }

  // Test 7: Withdrawal password OTP
  console.log('\n📨 Test 7: Testing withdrawal password OTP email...');
  const withdrawalOtpResult = await emailService.sendWithdrawalPasswordOTPEmail(
    TEST_EMAIL,
    {
      firstName: 'Test',
      otp: '654321',
      expiresIn: '10 minutes',
      isCreation: true
    }
  );
  
  if (withdrawalOtpResult.success) {
    console.log(`✅ Withdrawal password OTP email sent successfully!`);
    console.log(`   Message ID: ${withdrawalOtpResult.messageId}`);
  } else {
    console.error(`❌ Withdrawal password OTP email failed: ${withdrawalOtpResult.error}`);
  }

  // Test 8: Deposit confirmation email
  console.log('\n📨 Test 8: Testing deposit confirmation email...');
  const depositResult = await emailService.sendDepositConfirmationEmail(
    TEST_EMAIL,
    {
      firstName: 'Test',
      amount: '1000',
      currency: 'USDT',
      transactionId: 'TXN123456789',
      date: new Date()
    }
  );
  
  if (depositResult.success) {
    console.log(`✅ Deposit confirmation email sent successfully!`);
    console.log(`   Message ID: ${depositResult.messageId}`);
  } else {
    console.error(`❌ Deposit confirmation email failed: ${depositResult.error}`);
  }

  // Test 9: Daily reward reminder
  console.log('\n📨 Test 9: Testing daily reward reminder email...');
  const rewardResult = await emailService.sendDailyRewardReminder(
    TEST_EMAIL,
    {
      firstName: 'Test',
      vipLevel: 3,
      dailyReward: 25
    }
  );
  
  if (rewardResult.success) {
    console.log(`✅ Daily reward reminder sent successfully!`);
    console.log(`   Message ID: ${rewardResult.messageId}`);
  } else {
    console.error(`❌ Daily reward reminder failed: ${rewardResult.error}`);
  }

  // Test 10: Custom email
  console.log('\n📨 Test 10: Testing custom email...');
  const customResult = await emailService.sendCustomEmail(
    TEST_EMAIL,
    '🎯 Custom Test Email -  NexaBit',
    `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h1 style="color: #4F46E5;">Custom Email Test</h1>
        <p>This is a custom email sent from the  NexaBit email service.</p>
        <p><strong>Timestamp:</strong> ${new Date().toISOString()}</p>
      </div>
    `
  );
  
  if (customResult.success) {
    console.log(`✅ Custom email sent successfully!`);
    console.log(`   Message ID: ${customResult.messageId}`);
  } else {
    console.error(`❌ Custom email failed: ${customResult.error}`);
  }

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('\n🎉 Email Service Test Completed!');
  console.log('\n📬 Please check your inbox at:', TEST_EMAIL);
  console.log('   You should have received 10 test emails.');
  console.log('\n💡 Tips:');
  console.log('   - Check your spam/junk folder if you don\'t see the emails');
  console.log('   - Verify the sender address is correct');
  console.log('   - Check email server logs for any delivery issues');
  console.log('═══════════════════════════════════════════════════════════════\n');

  process.exit(0);
}

// Handle errors
process.on('unhandledRejection', (error) => {
  console.error('\n❌ Unhandled Error:', error);
  process.exit(1);
});

// Run the test
testEmailService().catch((error) => {
  console.error('\n❌ Test Failed:', error);
  process.exit(1);
});
