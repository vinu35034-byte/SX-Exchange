require('dotenv').config(); 

const { spawn } = require('child_process');
const path = require('path');
const { createLogger } = require('../utils/logger');

const logger = createLogger('setup-production');

const scripts = [
  { name: 'Create Default Admin', file: 'createDefaultAdmin.js', required: true },
  { name: 'Initialize VIP Levels', file: 'initVIPLevels.js', required: true },
  { name: 'Initialize Real-Time Market Data', file: 'initRealTimeMarketData.js', required: true },
  { name: 'Update Market Coins Configuration', file: 'updateMarketCoins.js', required: true },
  { name: 'Check Coins Configuration', file: 'checkCoins.js', required: true },
  { name: 'Initialize Staking Pools', file: 'initializeStakingPools.js', required: true },
  { name: 'Verify VIP Levels', file: 'checkAndCreateVIPLevels.js', required: false }
];

async function runScript(scriptFile) {
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(__dirname, scriptFile);
    
    logger.info('Starting production setup script', {
      scriptFile,
      scriptPath,
      timestamp: new Date().toISOString()
    });
    
    console.log(`\n🚀 Running: ${scriptFile}`);
    console.log('='.repeat(50));

    const child = spawn('node', [scriptPath], {
      stdio: 'inherit',
      cwd: __dirname
    });

    child.on('close', (code) => {
      if (code === 0) {
        logger.info('Production setup script completed successfully', {
          scriptFile,
          exitCode: code,
          timestamp: new Date().toISOString()
        });
        console.log(`✅ ${scriptFile} completed successfully`);
        resolve();
      } else {
        logger.error('Production setup script failed', {
          scriptFile,
          exitCode: code,
          timestamp: new Date().toISOString()
        });
        console.error(`❌ ${scriptFile} failed with code ${code}`);
        reject(new Error(`Script ${scriptFile} failed`));
      }
    });

    child.on('error', (error) => {
      logger.error('Error running production setup script', {
        scriptFile,
        error: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString()
      });
      console.error(`❌ Error running ${scriptFile}:`, error);
      reject(error);
    });
  });
}

async function setupProduction() {
  logger.info('Production setup starting', {
    timestamp: new Date().toISOString(),
    nodeEnv: process.env.NODE_ENV
  });
  
  console.log('🏗️  PRODUCTION SETUP STARTING');
  console.log('='.repeat(60));
  
  // Environment validation
  console.log('🔍 Validating environment...');
  const requiredEnvVars = ['MONGO_URI', 'MONGODB_DB_NAME', 'JWT_SECRET_USER', 'JWT_SECRET_ADMIN', 'SESSION_SECRET'];
  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    logger.error('Missing required environment variables', {
      missingVars,
      timestamp: new Date().toISOString()
    });
    console.error('❌ Missing required environment variables:', missingVars.join(', '));
    console.error('Please check your .env file and ensure all required variables are set.');
    process.exit(1);
  }
  
  logger.info('Environment validation completed', {
    nodeEnv: process.env.NODE_ENV || 'development',
    mongoUri: process.env.MONGO_URI ? 'configured' : 'missing',
    timestamp: new Date().toISOString()
  });
  
  console.log('✅ Environment validation passed');
  console.log('Environment:', process.env.NODE_ENV || 'development');
  console.log('Database:', process.env.MONGO_URI || 'Not configured');
  console.log('='.repeat(60));

  for (const script of scripts) {
    try {
      await runScript(script.file);
      logger.info('Production setup script completed', {
        scriptName: script.name,
        scriptFile: script.file,
        timestamp: new Date().toISOString()
      });
      console.log(`✅ ${script.name} - COMPLETED`);
    } catch (error) {
      if (script.required) {
        logger.error('Critical production setup script failed', {
          scriptName: script.name,
          scriptFile: script.file,
          error: error.message,
          timestamp: new Date().toISOString()
        });
        console.error(`💥 CRITICAL ERROR: ${script.name} failed`);
        console.error('Production setup cannot continue.');
        process.exit(1);
      } else {
        logger.warn('Optional production setup script failed', {
          scriptName: script.name,
          scriptFile: script.file,
          error: error.message,
          timestamp: new Date().toISOString()
        });
        console.warn(`⚠️  WARNING: ${script.name} failed (non-critical)`);
      }
    }
  }

  logger.info('Production setup completed successfully', {
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });

  console.log('\n🎉 PRODUCTION SETUP COMPLETED SUCCESSFULLY!');
  console.log('='.repeat(60));
  console.log('✅ Database initialized');
  console.log('✅ Admin account created');
  console.log('✅ VIP system configured');
  console.log('✅ Real-time market data initialized');
  console.log('✅ Trading pairs configured with live prices');
  console.log('✅ Market coin priorities set');
  console.log('✅ Staking pools initialized');
  console.log('\n🚀 Your crypto trading platform is ready for production!');
  console.log('\n📋 Next steps:');
  console.log('1. Start your server: npm start');
  console.log('2. Monitor logs for any issues');
  console.log('3. Test key functionalities');
  console.log('4. Verify market tickers API: GET /api/market/tickers');
  console.log('5. Test admin login and user registration');
  console.log('6. Test staking functionality: GET /api/staking/pools');
  console.log('7. Real-time price updates will start automatically');
  
  process.exit(0);
}

// Handle errors gracefully
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled rejection in production setup', {
    promise: promise.toString(),
    reason: reason.toString(),
    timestamp: new Date().toISOString()
  });
  console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception in production setup', {
    error: error.message,
    stack: error.stack,
    timestamp: new Date().toISOString()
  });
  console.error('💥 Uncaught Exception:', error);
  process.exit(1);
});

// Run the setup
setupProduction().catch(error => {
  logger.error('Production setup process failed', {
    error: error.message,
    stack: error.stack,
    timestamp: new Date().toISOString()
  });
  console.error('💥 Production setup failed:', error);
  process.exit(1);
});
