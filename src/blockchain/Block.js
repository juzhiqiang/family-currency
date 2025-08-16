import crypto from 'crypto';

export class Block {
  constructor(timestamp, transactions, previousHash = '') {
    this.timestamp = timestamp;
    this.transactions = transactions;
    this.previousHash = previousHash;
    this.hash = this.calculateHash();
    this.nonce = 0;
    this.miner = '';
  }

  /**
   * 计算区块哈希
   */
  calculateHash() {
    return crypto
      .createHash('sha256')
      .update(
        this.previousHash +
        this.timestamp +
        JSON.stringify(this.transactions) +
        this.nonce +
        this.miner
      )
      .digest('hex');
  }

  /**
   * 挖矿 - 工作量证明
   */
  mineBlock(difficulty, minerAddress) {
    this.miner = minerAddress;
    const target = Array(difficulty + 1).join('0');
    
    console.log(`⛏️  开始挖矿区块 #${this.timestamp}...`);
    const startTime = Date.now();
    
    while (this.hash.substring(0, difficulty) !== target) {
      this.nonce++;
      this.hash = this.calculateHash();
      
      // 每100000次尝试输出一次进度
      if (this.nonce % 100000 === 0) {
        console.log(`   尝试次数: ${this.nonce}, 当前哈希: ${this.hash}`);
      }
    }
    
    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);
    
    console.log(`✅ 区块挖矿成功!`);
    console.log(`   哈希: ${this.hash}`);
    console.log(`   Nonce: ${this.nonce}`);
    console.log(`   耗时: ${duration}秒`);
    console.log(`   矿工: ${minerAddress}`);
  }

  /**
   * 验证区块是否有效
   */
  hasValidTransactions() {
    for (const tx of this.transactions) {
      if (!tx.isValid()) {
        return false;
      }
    }
    return true;
  }

  /**
   * 获取区块大小（字节）
   */
  getSize() {
    return Buffer.byteLength(JSON.stringify(this), 'utf8');
  }

  /**
   * 转换为JSON格式
   */
  toJSON() {
    return {
      timestamp: this.timestamp,
      transactions: this.transactions.map(tx => tx.toJSON ? tx.toJSON() : tx),
      previousHash: this.previousHash,
      hash: this.hash,
      nonce: this.nonce,
      miner: this.miner,
      size: this.getSize()
    };
  }
}
