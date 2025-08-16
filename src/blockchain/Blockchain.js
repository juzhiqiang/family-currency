import { Block } from './Block.js';
import { Transaction } from './Transaction.js';

export class Blockchain {
  constructor() {
    this.chain = [this.createGenesisBlock()];
    this.difficulty = 2; // 挖矿难度
    this.pendingTransactions = [];
    this.miningReward = 100; // 挖矿奖励
    this.accounts = new Map(); // 账户余额
  }

  /**
   * 创建创世区块
   */
  createGenesisBlock() {
    const genesisTransactions = [
      Transaction.createMintTransaction('genesis-address', 1000000)
    ];
    return new Block(
      Date.parse('2025-01-01'),
      genesisTransactions,
      '0'
    );
  }

  /**
   * 获取最新区块
   */
  getLatestBlock() {
    return this.chain[this.chain.length - 1];
  }

  /**
   * 挖掘待处理交易
   */
  minePendingTransactions(miningRewardAddress) {
    if (this.pendingTransactions.length === 0) {
      console.log('📭 暂无待处理交易');
      return null;
    }

    // 添加挖矿奖励交易
    const rewardTransaction = Transaction.createMintTransaction(
      miningRewardAddress,
      this.miningReward
    );
    this.pendingTransactions.push(rewardTransaction);

    // 创建新区块
    const block = new Block(
      Date.now(),
      this.pendingTransactions,
      this.getLatestBlock().hash
    );

    // 挖矿
    block.mineBlock(this.difficulty, miningRewardAddress);

    // 添加到链中
    this.chain.push(block);

    // 更新账户余额
    this.updateBalances(block);

    // 清空待处理交易
    this.pendingTransactions = [];

    console.log(`🎉 新区块已添加到链中! 区块高度: ${this.chain.length - 1}`);
    return block;
  }

  /**
   * 创建交易
   */
  createTransaction(transaction) {
    // 验证交易
    if (!transaction.isValid()) {
      throw new Error('无效的交易!');
    }

    // 检查余额（除了铸造交易）
    if (transaction.type !== 'mint' && transaction.fromAddress) {
      const balance = this.getBalance(transaction.fromAddress);
      if (balance < transaction.amount + transaction.getFee()) {
        throw new Error('余额不足!');
      }
    }

    this.pendingTransactions.push(transaction);
    console.log(`📝 新交易已添加到交易池: ${transaction.txId}`);
  }

  /**
   * 获取账户余额
   */
  getBalance(address) {
    let balance = 0;

    for (const block of this.chain) {
      for (const trans of block.transactions) {
        if (trans.fromAddress === address) {
          balance -= trans.amount + trans.getFee();
        }

        if (trans.toAddress === address) {
          balance += trans.amount;
        }
      }
    }

    return balance;
  }

  /**
   * 更新所有账户余额
   */
  updateBalances(block) {
    for (const trans of block.transactions) {
      if (trans.fromAddress) {
        const currentBalance = this.accounts.get(trans.fromAddress) || 0;
        this.accounts.set(
          trans.fromAddress,
          currentBalance - trans.amount - trans.getFee()
        );
      }

      if (trans.toAddress) {
        const currentBalance = this.accounts.get(trans.toAddress) || 0;
        this.accounts.set(
          trans.toAddress,
          currentBalance + trans.amount
        );
      }
    }
  }

  /**
   * 获取所有交易历史
   */
  getAllTransactionsForWallet(address) {
    const txs = [];

    for (const block of this.chain) {
      for (const tx of block.transactions) {
        if (tx.fromAddress === address || tx.toAddress === address) {
          txs.push({
            ...tx.toJSON(),
            blockHeight: this.chain.indexOf(block),
            blockTimestamp: block.timestamp
          });
        }
      }
    }

    return txs;
  }

  /**
   * 验证整个区块链
   */
  isChainValid() {
    const realGenesis = JSON.stringify(this.createGenesisBlock());

    if (realGenesis !== JSON.stringify(this.chain[0])) {
      console.log('创世区块被篡改!');
      return false;
    }

    for (let i = 1; i < this.chain.length; i++) {
      const currentBlock = this.chain[i];
      const previousBlock = this.chain[i - 1];

      if (!currentBlock.hasValidTransactions()) {
        console.log(`区块 #${i} 包含无效交易!`);
        return false;
      }

      if (currentBlock.hash !== currentBlock.calculateHash()) {
        console.log(`区块 #${i} 哈希无效!`);
        return false;
      }

      if (currentBlock.previousHash !== previousBlock.hash) {
        console.log(`区块 #${i} 前一区块哈希无效!`);
        return false;
      }
    }

    return true;
  }

  /**
   * 获取区块链统计信息
   */
  getStats() {
    const totalSupply = Array.from(this.accounts.values())
      .reduce((sum, balance) => sum + balance, 0);

    return {
      height: this.chain.length - 1,
      totalBlocks: this.chain.length,
      totalTransactions: this.chain.reduce(
        (sum, block) => sum + block.transactions.length, 0
      ),
      totalSupply,
      difficulty: this.difficulty,
      pendingTransactions: this.pendingTransactions.length,
      miningReward: this.miningReward,
      isValid: this.isChainValid()
    };
  }

  /**
   * 获取指定高度的区块
   */
  getBlockByHeight(height) {
    if (height < 0 || height >= this.chain.length) {
      return null;
    }
    return this.chain[height];
  }

  /**
   * 根据哈希获取区块
   */
  getBlockByHash(hash) {
    return this.chain.find(block => block.hash === hash);
  }

  /**
   * 获取交易详情
   */
  getTransaction(txId) {
    for (const block of this.chain) {
      for (const tx of block.transactions) {
        if (tx.txId === txId) {
          return {
            ...tx.toJSON(),
            blockHeight: this.chain.indexOf(block),
            blockHash: block.hash,
            blockTimestamp: block.timestamp
          };
        }
      }
    }
    return null;
  }
}
