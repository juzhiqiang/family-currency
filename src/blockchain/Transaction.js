import crypto from 'crypto';
import { Wallet } from '../crypto/Wallet.js';

export class Transaction {
  constructor(fromAddress, toAddress, amount, type = 'transfer') {
    this.fromAddress = fromAddress;
    this.toAddress = toAddress;
    this.amount = amount;
    this.type = type; // 'transfer', 'mint', 'burn'
    this.timestamp = Date.now();
    this.nonce = Math.random(); // 添加随机数确保唯一性
    this.signature = '';
    this.txId = this.calculateTxId();
  }

  /**
   * 计算交易ID
   */
  calculateTxId() {
    return crypto
      .createHash('sha256')
      .update(
        this.fromAddress +
        this.toAddress +
        this.amount +
        this.type +
        this.timestamp +
        this.nonce
      )
      .digest('hex');
  }

  /**
   * 计算交易哈希（用于签名）
   */
  calculateHash() {
    return crypto
      .createHash('sha256')
      .update(
        this.fromAddress +
        this.toAddress +
        this.amount +
        this.type +
        this.timestamp +
        this.nonce
      )
      .digest('hex');
  }

  /**
   * 签名交易
   */
  signTransaction(privateKey) {
    if (this.fromAddress !== Wallet.getPublicKeyFromPrivate(privateKey)) {
      throw new Error('你不能签名其他钱包的交易!');
    }

    const hashTx = this.calculateHash();
    this.signature = Wallet.sign(hashTx, privateKey);
  }

  /**
   * 验证交易是否有效
   */
  isValid() {
    // 铸造交易不需要发送方
    if (this.type === 'mint' && this.fromAddress === null) {
      return true;
    }

    // 其他交易必须有签名
    if (!this.signature || this.signature.length === 0) {
      throw new Error('交易没有签名!');
    }

    // 验证签名
    try {
      const hashTx = this.calculateHash();
      return Wallet.verify(hashTx, this.signature, this.fromAddress);
    } catch (error) {
      console.error('交易验证失败:', error.message);
      return false;
    }
  }

  /**
   * 创建铸造交易
   */
  static createMintTransaction(toAddress, amount) {
    return new Transaction(null, toAddress, amount, 'mint');
  }

  /**
   * 创建转账交易
   */
  static createTransferTransaction(fromAddress, toAddress, amount) {
    return new Transaction(fromAddress, toAddress, amount, 'transfer');
  }

  /**
   * 创建销毁交易
   */
  static createBurnTransaction(fromAddress, amount) {
    return new Transaction(fromAddress, null, amount, 'burn');
  }

  /**
   * 获取交易手续费
   */
  getFee() {
    // 根据交易类型计算手续费
    switch (this.type) {
      case 'transfer':
        return this.amount * 0.001; // 0.1% 手续费
      case 'mint':
        return 0; // 铸造免费
      case 'burn':
        return 0; // 销毁免费
      default:
        return 0.01; // 默认手续费
    }
  }

  /**
   * 转换为JSON格式
   */
  toJSON() {
    return {
      txId: this.txId,
      fromAddress: this.fromAddress,
      toAddress: this.toAddress,
      amount: this.amount,
      type: this.type,
      timestamp: this.timestamp,
      nonce: this.nonce,
      signature: this.signature,
      fee: this.getFee()
    };
  }
}
