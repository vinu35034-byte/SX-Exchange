const bip39 = require('bip39');
const BIP32Factory = require('bip32');
const ecc = require('tiny-secp256k1');
const bip32 = BIP32Factory.BIP32Factory(ecc);
const { payments, networks } = require('bitcoinjs-lib');
const { Web3 } = require('web3');
const crypto = require('crypto');

class HDWalletService {
  constructor() {
    // Master seed phrase - should be stored securely in environment variables
    this.masterSeed = process.env.MASTER_SEED || this.generateMasterSeed();
    
    // Derivation path for BEP20 (BSC/Ethereum-compatible)
    this.derivationPath = "m/44'/60'/0'/0";
    
    // Initialize web3 instance for BSC
    this.web3 = new Web3(process.env.BSC_RPC_URL || 'https://bsc-dataseed1.binance.org:443');
    
    // USDT contract address on BSC
    this.usdtContract = '0x55d398326f99059fF775485246999027B3197955';
  }

  /**
   * Generate a new master seed if one doesn't exist
   */
  generateMasterSeed() {
    const mnemonic = bip39.generateMnemonic(256); // 24 words
   return mnemonic;
  }
  /**
   * Get master node from seed
   */
  getMasterNode() {
    const seed = bip39.mnemonicToSeedSync(this.masterSeed);
    return bip32.fromSeed(seed);
  }

  /**
   * Generate BEP20 deposit address for a user
   */
  generateDepositAddress(userId, addressIndex) {
    try {
      return this.generateBEP20Address(userId, addressIndex);
    } catch (error) {
      throw new Error(`Failed to generate BEP20 address: ${error.message}`);
    }
  }

  /**
   * Generate BEP20 deposit address for a user
   */
  generateBEP20Address(userId, addressIndex) {
    try {
      const masterNode = this.getMasterNode();
      const fullPath = `${this.derivationPath}/${addressIndex}`;
      
      const child = masterNode.derivePath(fullPath);
      const privateKey = '0x' + child.privateKey.toString('hex'); // Ensure 0x prefix
      
      // Generate Ethereum-compatible address for BSC
      const address = this.generateEthereumAddress(child.privateKey);
      
      return {
        address,
        privateKey,
        derivationPath: fullPath,
        addressIndex,
        network: 'BEP20'
      };
    } catch (error) {
      throw new Error(`Failed to generate BEP20 address: ${error.message}`);
    }
  }  /**
   * Generate Ethereum-compatible address (for BSC/BEP20)
   */
  generateEthereumAddress(privateKey) {
    let privateKeyHex;
    if (Buffer.isBuffer(privateKey)) {
      privateKeyHex = '0x' + privateKey.toString('hex');
    } else if (privateKey instanceof Uint8Array) {
      privateKeyHex = '0x' + Buffer.from(privateKey).toString('hex');
    } else if (typeof privateKey === 'string') {
      privateKeyHex = privateKey.startsWith('0x') ? privateKey : '0x' + privateKey;
    } else {
      throw new Error('Invalid private key format');
    }
    
    const account = this.web3.eth.accounts.privateKeyToAccount(privateKeyHex);
    return account.address;
  }

  /**
   * Check USDT balance for BEP20 address
   */
  async checkBalance(address) {
    try {
      const contract = new this.web3.eth.Contract([
        {
          constant: true,
          inputs: [{ name: '_owner', type: 'address' }],
          name: 'balanceOf',
          outputs: [{ name: 'balance', type: 'uint256' }],
          type: 'function'
        }
      ], this.usdtContract);

      const balance = await contract.methods.balanceOf(address).call();
      return this.web3.utils.fromWei(balance, 'ether'); // USDT has 18 decimals on BSC, use 'ether' for 18 decimals
    } catch (error) {
      return 0;
    }
  }

  /**
   * Get transaction history for BEP20 address
   */
  async getTransactions(address, fromBlock = 'latest') {
    try {
      const response = await fetch(
        `https://api.bscscan.com/api?module=account&action=tokentx&contractaddress=${this.usdtContract}&address=${address}&startblock=0&endblock=99999999&sort=desc&apikey=${process.env.BSCSCAN_API_KEY}`
      );
      const data = await response.json();
      return data.result || [];
    } catch (error) {
      return [];
    }
  }

  /**
   * Sweep funds from user wallet to master wallet
   */
  async sweepFunds(depositAddress, masterWalletAddress, amount) {
    try {
      return await this.sweepBEP20(depositAddress, masterWalletAddress, amount);
    } catch (error) {
      throw new Error(`Failed to sweep BEP20 funds: ${error.message}`);
    }
  }

  /**
   * Sweep BEP20 USDT funds
   */
  async sweepBEP20(depositAddress, masterWalletAddress, amount) {
    try {
      // Get the private key for this deposit address
      const DepositAddress = require('../models/depositAddress');
      const depositRecord = await DepositAddress.findOne({ address: depositAddress.address });
      
      if (!depositRecord) {
        throw new Error('Deposit address not found in database');
      }

      // Decrypt the private key
      const encryptedKey = JSON.parse(depositRecord.privateKey);
      
      const rawPrivateKey = this.decryptPrivateKey(encryptedKey);
     
      // Handle case where private key is stored as comma-separated decimal values
      let privateKey;
      if (typeof rawPrivateKey === 'string' && rawPrivateKey.includes(',') && rawPrivateKey.startsWith('0x')) {
        // Convert comma-separated decimal values to hex (same as diagnostic script)
        const byteString = rawPrivateKey.substring(2); // Remove "0x" prefix
        const byteArray = byteString.split(',').map(b => parseInt(b.trim()));
        const hexString = byteArray.map(b => b.toString(16).padStart(2, '0')).join('');
        privateKey = '0x' + hexString;
      } else {
        // Ensure private key has proper 0x prefix
        privateKey = rawPrivateKey.startsWith('0x') ? rawPrivateKey : '0x' + rawPrivateKey;
      }
    
      // Check current balance
      const balance = await this.checkBalance(depositAddress.address);
      if (parseFloat(balance) < amount) {
        throw new Error(`Insufficient balance. Available: ${balance}, Requested: ${amount}`);
      }

      // Create USDT contract instance
      const usdtContract = new this.web3.eth.Contract([
        {
          constant: false,
          inputs: [
            { name: '_to', type: 'address' },
            { name: '_value', type: 'uint256' }
          ],
          name: 'transfer',
          outputs: [{ name: '', type: 'bool' }],
          type: 'function'
        }
      ], this.usdtContract);

      // Convert amount to wei (USDT has 18 decimals on BSC)
      const amountInWei = this.web3.utils.toWei(amount.toString(), 'ether');

      // Create transaction data
      const txData = usdtContract.methods.transfer(masterWalletAddress, amountInWei).encodeABI();

      // Estimate gas for the specific transaction
      let estimatedGas;
      try {
        estimatedGas = await this.web3.eth.estimateGas({
          from: depositAddress.address,
          to: this.usdtContract,
          data: txData
        });
        // Add 20% buffer to estimated gas
        estimatedGas = Math.ceil(Number(estimatedGas) * 1.2);
      } catch (error) {
        estimatedGas = 65000; // Fallback gas limit
      }

     
      // Estimate gas costs using the estimated gas
      const gasPrice = await this.web3.eth.getGasPrice();
      const gasCost = this.web3.utils.fromWei((BigInt(gasPrice) * BigInt(estimatedGas)).toString(), 'ether');

      // Check if wallet has enough BNB for gas
      const bnbBalance = await this.web3.eth.getBalance(depositAddress.address);
      const bnbBalanceInEther = this.web3.utils.fromWei(bnbBalance, 'ether');
      
      if (parseFloat(bnbBalanceInEther) < parseFloat(gasCost)) {
        throw new Error(`Insufficient BNB for gas. Required: ${gasCost} BNB, Available: ${bnbBalanceInEther} BNB`);
      }

      // Build transaction
      const nonce = await this.web3.eth.getTransactionCount(depositAddress.address);
      const transaction = {
        from: depositAddress.address,
        to: this.usdtContract,
        value: '0', // No BNB being sent, just USDT
        gas: estimatedGas, // Use the estimated gas with buffer
        gasPrice: gasPrice,
        nonce: nonce,
        data: txData
      };

      // Sign transaction
      const signedTx = await this.web3.eth.accounts.signTransaction(transaction, privateKey);

      // Send transaction
      const receipt = await this.web3.eth.sendSignedTransaction(signedTx.rawTransaction);

      return {
        success: true,
        txHash: receipt.transactionHash,
        from: depositAddress.address,
        to: masterWalletAddress,
        amount: amount,
        gasUsed: receipt.gasUsed,
        blockNumber: receipt.blockNumber
      };

    } catch (error) {
      throw new Error(`Failed to sweep BEP20 funds: ${error.message}`);
    }
  }  /**
   * Encrypt private key for storage
   */
  encryptPrivateKey(privateKey) {
    const algorithm = 'aes-256-cbc';
    const password = process.env.ENCRYPTION_KEY || 'default-encryption-key-change-this';
    
    // Create a key from the password
    const key = crypto.scryptSync(password, 'salt', 32);
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(algorithm, key, iv);
    
    let encrypted = cipher.update(privateKey, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    return {
      encrypted: encrypted,
      iv: iv.toString('hex'),
      authTag: null // Not used with CBC
    };
  }  /**
   * Decrypt private key for use
   */
  decryptPrivateKey(encryptedData) {
    try {
      
      const algorithm = 'aes-256-cbc';
      const password = process.env.ENCRYPTION_KEY || 'default-encryption-key-change-this';
      
      // Create the same key from the password
      const key = crypto.scryptSync(password, 'salt', 32);
      const iv = Buffer.from(encryptedData.iv, 'hex');
      const decipher = crypto.createDecipheriv(algorithm, key, iv);
      
      let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      throw new Error(`Failed to decrypt private key: ${error.message}`);
    }
  }
  /**
   * Validate address format
   */
  isValidAddress(address) {
    return this.web3.utils.isAddress(address);
  }

  /**
   * Fund an address with BNB for gas fees
   */
  async fundAddressForGas(toAddress, bnbAmount = '0.001', customNonce = null, gasPriceMultiplier = 1.2) {
    console.log(`🚀 fundAddressForGas called with: toAddress=${toAddress}, bnbAmount=${bnbAmount}, customNonce=${customNonce}, gasPriceMultiplier=${gasPriceMultiplier}`);
    console.log(`🔍 Parameter types: bnbAmount=${typeof bnbAmount}, customNonce=${typeof customNonce}, gasPriceMultiplier=${typeof gasPriceMultiplier}`);
    
    try {
      const masterPrivateKey = process.env.MASTER_WALLET_PRIVATE_KEY;
      if (!masterPrivateKey) {
        throw new Error('Master wallet private key not configured');
      }
      console.log(`✅ Master private key found`);

      // Ensure private key has 0x prefix
      const formattedPrivateKey = masterPrivateKey.startsWith('0x') ? masterPrivateKey : '0x' + masterPrivateKey;
      console.log(`✅ Private key formatted`);

      const masterAccount = this.web3.eth.accounts.privateKeyToAccount(formattedPrivateKey);
      console.log(`✅ Master account created: ${masterAccount.address}`);
      
      // Check master wallet BNB balance
      console.log(`🔍 Checking master wallet balance...`);
      const masterBalance = await this.web3.eth.getBalance(masterAccount.address);
      console.log(`🔍 Got master balance: ${typeof masterBalance}, ${masterBalance}`);
      const masterBalanceInEther = this.web3.utils.fromWei(masterBalance.toString(), 'ether');
      console.log(`🔍 Master balance in ether: ${masterBalanceInEther}`);
      
      if (parseFloat(masterBalanceInEther) < parseFloat(bnbAmount)) {
        throw new Error(`Master wallet insufficient BNB. Required: ${bnbAmount}, Available: ${masterBalanceInEther}`);
      }
      console.log(`✅ Balance check passed`);

      // Get gas price with multiplier for faster confirmation and avoid underpriced errors
      let gasPrice;
      try {
        const baseGasPrice = await this.web3.eth.getGasPrice();
        console.log(`🔍 baseGasPrice type: ${typeof baseGasPrice}, value: ${baseGasPrice}`);
        console.log(`🔍 gasPriceMultiplier type: ${typeof gasPriceMultiplier}, value: ${gasPriceMultiplier}`);
        
        const baseGasPriceNumber = Number(baseGasPrice);
        console.log(`🔍 baseGasPriceNumber type: ${typeof baseGasPriceNumber}, value: ${baseGasPriceNumber}`);
        
        const gasPriceNumber = Math.floor(baseGasPriceNumber * gasPriceMultiplier);
        console.log(`🔍 gasPriceNumber type: ${typeof gasPriceNumber}, value: ${gasPriceNumber}`);
        
        gasPrice = gasPriceNumber.toString();
        console.log(`🔍 gasPrice type: ${typeof gasPrice}, value: ${gasPrice}`);
      } catch (gasPriceError) {
        console.error(`❌ Error calculating gas price: ${gasPriceError.message}`);
        throw gasPriceError;
      }
      
      // Get nonce - use custom nonce if provided, otherwise get latest including pending
      let nonce;
      if (customNonce !== null) {
        nonce = customNonce;
      } else {
        nonce = await this.web3.eth.getTransactionCount(masterAccount.address, 'pending');
      }
      
      try {
        console.log(`🔍 Creating transaction with bnbAmount: ${bnbAmount}`);
        const weiValue = this.web3.utils.toWei(bnbAmount, 'ether');
        console.log(`🔍 Wei value type: ${typeof weiValue}, value: ${weiValue}`);
        
        const transaction = {
          from: masterAccount.address,
          to: toAddress,
          value: weiValue,
          gas: 21000,
          gasPrice: gasPrice,
          nonce: nonce
        };

        console.log(`💰 Funding ${toAddress} with ${bnbAmount} BNB (nonce: ${nonce}, gasPrice: ${gasPrice})`);

        // Sign and send transaction
        const signedTx = await this.web3.eth.accounts.signTransaction(transaction, formattedPrivateKey);
        const receipt = await this.web3.eth.sendSignedTransaction(signedTx.rawTransaction);

        console.log(`✅ Funded ${toAddress} successfully - TxHash: ${receipt.transactionHash}`);

        return {
          success: true,
          txHash: receipt.transactionHash,
          amount: bnbAmount,
          to: toAddress,
          nonce: nonce,
          gasPrice: gasPrice
        };
      } catch (txError) {
        console.error(`❌ Error creating/sending transaction: ${txError.message}`);
        throw txError;
      }

    } catch (error) {
      console.error(`❌ Failed to fund ${toAddress}:`, error.message);
      throw new Error(`Failed to fund address: ${error.message}`);
    }
  }

  /**
   * Bulk fund multiple addresses with proper nonce management
   */
  async bulkFundAddressesForGas(addresses, bnbAmount = '0.001') {
    if (!addresses || addresses.length === 0) {
      throw new Error('No addresses provided for bulk funding');
    }

    try {
      const masterPrivateKey = process.env.MASTER_WALLET_PRIVATE_KEY;
      if (!masterPrivateKey) {
        throw new Error('Master wallet private key not configured');
      }

      const formattedPrivateKey = masterPrivateKey.startsWith('0x') ? masterPrivateKey : '0x' + masterPrivateKey;
      const masterAccount = this.web3.eth.accounts.privateKeyToAccount(formattedPrivateKey);
      
      // Check total BNB required vs available
      const totalRequired = parseFloat(bnbAmount) * parseInt(addresses.length);
      console.log(`🔍 Total BNB required: ${totalRequired} for ${addresses.length} addresses`);
      
      const masterBalance = await this.web3.eth.getBalance(masterAccount.address);
      console.log(`🔍 Master balance type: ${typeof masterBalance}, value: ${masterBalance}`);
      
      const masterBalanceInEther = this.web3.utils.fromWei(masterBalance.toString(), 'ether');
      const masterBalanceFloat = parseFloat(masterBalanceInEther);
      
      console.log(`🔍 Master balance in ether: ${masterBalanceFloat}`);
      console.log(`🔍 Comparison: ${masterBalanceFloat} < ${totalRequired} = ${masterBalanceFloat < totalRequired}`);
      
      if (masterBalanceFloat < totalRequired) {
        throw new Error(`Insufficient BNB. Required: ${totalRequired}, Available: ${masterBalanceFloat}`);
      }

      // Get starting nonce (no need to get gas price here since fundAddressForGas handles it)
      let currentNonce = await this.web3.eth.getTransactionCount(masterAccount.address, 'pending');
      console.log(`🔍 currentNonce type: ${typeof currentNonce}, value: ${currentNonce}`);
      
      // Convert BigInt nonce to number for arithmetic operations
      currentNonce = Number(currentNonce);
      console.log(`🔍 currentNonce converted to number: ${currentNonce}`);
      
      const results = [];
      const batchSize = 5; // Process in small batches
      
      for (let i = 0; i < addresses.length; i += batchSize) {
        const batch = addresses.slice(i, i + batchSize);
        
        const batchPromises = batch.map(async (address, batchIndex) => {
          try {
            // Use incremented nonce for each transaction in sequence
            const txNonce = currentNonce + i + batchIndex;
            // Increase gas price slightly for each subsequent transaction
            const gasPriceMultiplier = 1.2 + (batchIndex * 0.1);
            
            const result = await this.fundAddressForGas(
              address, 
              bnbAmount, 
              txNonce, 
              gasPriceMultiplier
            );
            
            return { success: true, address, result };
          } catch (error) {
            console.error(`Failed to fund ${address}:`, error.message);
            return { success: false, address, error: error.message };
          }
        });
        
        // Wait for batch to complete
        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);
        
        // Update nonce for next batch
        currentNonce += batch.length;
        
        // Small delay between batches
        if (i + batchSize < addresses.length) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
      
      const successCount = results.filter(r => r.success).length;
      const failCount = results.filter(r => !r.success).length;
      
      console.log(`🎯 Bulk funding completed: ${successCount} success, ${failCount} failed`);
      
      return {
        success: true,
        totalProcessed: addresses.length,
        successCount,
        failCount,
        results
      };

    } catch (error) {
      console.error('Bulk funding error:', error.message);
      throw new Error(`Bulk funding failed: ${error.message}`);
    }
  }

  /**
   * Auto-sweep funds with gas funding if needed
   */
  async autoSweepWithGasFunding(depositAddress, masterWalletAddress, amount) {
    try {
      // First, try to sweep directly
      try {
        return await this.sweepBEP20(depositAddress, masterWalletAddress, amount);
      } catch (error) {
        // If it fails due to insufficient gas, fund the address and try again
        if (error.message.includes('Insufficient BNB for gas')) {
        
          // Fund the address with BNB for gas
          await this.fundAddressForGas(depositAddress.address, '0.002'); // 0.002 BNB should be enough
          
          // Wait a moment for the transaction to confirm
          await new Promise(resolve => setTimeout(resolve, 3000));
          
          // Try sweeping again
          return await this.sweepBEP20(depositAddress, masterWalletAddress, amount);
        }
        throw error;
      }
    } catch (error) {
      throw new Error(`Auto-sweep failed: ${error.message}`);
    }
  }

  /**
   * Sweep all deposit addresses with USDT balances to master wallet
   */
  async sweepAllAddresses(masterWalletAddress, minSweepAmount = 1) {
    try {
      const DepositAddress = require('../models/depositAddress');
      const depositAddresses = await DepositAddress.find({ network: 'BEP20' }).populate('userId');
      
      if (!depositAddresses || depositAddresses.length === 0) {
        return {
          success: true,
          message: 'No deposit addresses found',
          results: []
        };
      }

      const sweepResults = [];
      let totalSwept = 0;
      let successCount = 0;
      let errorCount = 0;

      for (const depositAddr of depositAddresses) {
        try {
          // Check balance
          const balance = await this.checkBalance(depositAddr.address);
          const balanceFloat = parseFloat(balance);

          if (balanceFloat >= minSweepAmount) {

            // Attempt to sweep
            const sweepResult = await this.autoSweepWithGasFunding(
              depositAddr,
              masterWalletAddress,
              balanceFloat
            );

            if (sweepResult.success) {
              sweepResults.push({
                address: depositAddr.address,
                user: depositAddr.userId?.username || 'Unknown',
                amount: balanceFloat,
                txHash: sweepResult.txHash,
                status: 'success'
              });
              
              totalSwept += balanceFloat;
              successCount++;
            } else {
              sweepResults.push({
                address: depositAddr.address,
                user: depositAddr.userId?.username || 'Unknown',
                amount: balanceFloat,
                status: 'failed',
                error: 'Sweep operation failed'
              });
              errorCount++;
            }
          } else if (balanceFloat > 0) {
            sweepResults.push({
              address: depositAddr.address,
              user: depositAddr.userId?.username || 'Unknown',
              amount: balanceFloat,
              status: 'skipped',
              reason: `Below minimum sweep amount (${minSweepAmount} USDT)`
            });
          }

          // Small delay between sweeps to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 1000));

        } catch (error) {
          sweepResults.push({
            address: depositAddr.address,
            user: depositAddr.userId?.username || 'Unknown',
            status: 'error',
            error: error.message
          });
          errorCount++;
        }
      }

      return {
        success: true,
        summary: {
          totalAddresses: depositAddresses.length,
          successCount,
          errorCount,
          totalSwept,
          masterWallet: masterWalletAddress
        },
        results: sweepResults
      };

    } catch (error) {
      throw new Error(`Bulk sweep failed: ${error.message}`);
    }
  }

  /**
   * Get sweep preview - check what would be swept without actually doing it
   */
  async getSweepPreview(minSweepAmount = 1) {
    try {
      const DepositAddress = require('../models/depositAddress');
      const depositAddresses = await DepositAddress.find({ network: 'BEP20' }).populate('userId');
      
      if (!depositAddresses || depositAddresses.length === 0) {
        return {
          totalAddresses: 0,
          sweepableAddresses: 0,
          totalSweepable: 0,
          details: []
        };
      }
      const preview = [];
      let totalSweepable = 0;
      let sweepableCount = 0;

      for (const depositAddr of depositAddresses) {
        try {
          const balance = await this.checkBalance(depositAddr.address);
          const balanceFloat = parseFloat(balance);

          // Always include the address in preview, regardless of balance
          const addressInfo = {
            address: depositAddr.address,
            user: depositAddr.userId?.username || 'Unknown',
            balance: balanceFloat,
            sweepable: balanceFloat >= minSweepAmount
          };

          if (balanceFloat >= minSweepAmount) {
            totalSweepable += balanceFloat;
            sweepableCount++;
          } else if (balanceFloat > 0) {
            addressInfo.reason = `Below minimum (${minSweepAmount} USDT)`;
          } else {
            addressInfo.reason = 'No funds';
          }

          preview.push(addressInfo);
        } catch (error) {
          preview.push({
            address: depositAddr.address,
            user: depositAddr.userId?.username || 'Unknown',
            balance: 0,
            sweepable: false,
            error: error.message
          });
        }
      }

      return {
        totalAddresses: depositAddresses.length,
        sweepableAddresses: sweepableCount,
        totalSweepable,
        minSweepAmount,
        details: preview.sort((a, b) => (b.balance || 0) - (a.balance || 0)) // Sort by balance descending
      };

    } catch (error) {
      throw new Error(`Failed to get sweep preview: ${error.message}`);
    }
  }
}

module.exports = new HDWalletService();
