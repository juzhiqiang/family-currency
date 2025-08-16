import { Blockchain } from '../blockchain/Blockchain.js';
import { Wallet } from '../crypto/Wallet.js';

class Miner {
  constructor() {
    this.blockchain = new Blockchain();
    this.wallet = Wallet.generate();
    this.isRunning = false;
    this.hashRate = 0;
    this.totalHashes = 0;
    this.blocksFound = 0;
  }

  /**
   * 开始挖矿
   */
  start() {
    if (this.isRunning) {
      console.log('⚠️  挖矿程序已在运行中...');
      return;
    }

    this.isRunning = true;
    console.log('⛏️  Family Currency 挖矿程序启动!');
    console.log(`👷 矿工地址: ${this.wallet.getAddress()}`);
    console.log(`💎 挖矿奖励: ${this.blockchain.miningReward} FC`);
    console.log('─'.repeat(60));

    // 开始挖矿循环
    this.miningLoop();

    // 每5秒显示一次挖矿统计
    this.statsInterval = setInterval(() => {
      this.displayStats();
    }, 5000);
  }

  /**
   * 停止挖矿
   */
  stop() {
    this.isRunning = false;
    if (this.statsInterval) {
      clearInterval(this.statsInterval);
    }
    console.log('🛑 挖矿程序已停止');
  }

  /**
   * 挖矿主循环
   */
  async miningLoop() {
    while (this.isRunning) {
      try {
        await this.mineBlock();
        // 挖到区块后短暂休息
        await this.sleep(1000);
      } catch (error) {
        console.error('❌ 挖矿过程中发生错误:', error.message);
        await this.sleep(5000); // 错误后等待5秒再继续
      }
    }
  }

  /**
   * 挖掘单个区块
   */
  async mineBlock() {
    // 检查是否有待处理的交易
    if (this.blockchain.pendingTransactions.length === 0) {
      // 没有交易时创建一个空区块（仅包含挖矿奖励）
      console.log('📑 暂无待处理交易，等待中...');
      await this.sleep(10000); // 等待10秒
      return;
    }

    console.log(`⛏️  开始挖掘新区块 (难度: ${this.blockchain.difficulty})`);
    const startTime = Date.now();
    const startHashes = this.totalHashes;

    // 执行挖矿
    const block = this.blockchain.minePendingTransactions(this.wallet.getAddress());
    
    if (block) {
      const endTime = Date.now();
      const duration = (endTime - startTime) / 1000;
      const hashesInThisBlock = this.totalHashes - startHashes;
      
      this.blocksFound++;
      
      console.log('🎉 恭喜！挖到新区块!');
      console.log(`   区块高度: ${this.blockchain.chain.length - 1}`);
      console.log(`   区块哈希: ${block.hash}`);
      console.log(`   挖矿耗时: ${duration.toFixed(2)}秒`);
      console.log(`   本次哈希: ${hashesInThisBlock.toLocaleString()}`);
      console.log(`   获得奖励: ${this.blockchain.miningReward} FC`);
      console.log(`   当前余额: ${this.blockchain.getBalance(this.wallet.getAddress())} FC`);
      console.log('─'.repeat(60));
    }
  }

  /**
   * 显示挖矿统计信息
   */
  displayStats() {
    const uptime = process.uptime();
    const avgHashRate = this.totalHashes / uptime;
    const balance = this.blockchain.getBalance(this.wallet.getAddress());
    
    console.log('📊 挖矿统计:');
    console.log(`   运行时间: ${this.formatTime(uptime)}`);
    console.log(`   已挖区块: ${this.blocksFound}`);
    console.log(`   总哈希数: ${this.totalHashes.toLocaleString()}`);
    console.log(`   平均算力: ${avgHashRate.toFixed(2)} H/s`);
    console.log(`   当前余额: ${balance} FC`);
    console.log(`   区块高度: ${this.blockchain.chain.length - 1}`);
    console.log(`   待处理TX: ${this.blockchain.pendingTransactions.length}`);
    console.log('─'.repeat(60));
  }

  /**
   * 格式化时间显示
   */
  formatTime(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  /**
   * 休眠函数
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 获取挖矿信息
   */
  getInfo() {
    const uptime = process.uptime();
    const avgHashRate = this.totalHashes / uptime;
    
    return {
      isRunning: this.isRunning,
      minerAddress: this.wallet.getAddress(),
      balance: this.blockchain.getBalance(this.wallet.getAddress()),
      blocksFound: this.blocksFound,
      totalHashes: this.totalHashes,
      avgHashRate: avgHashRate.toFixed(2),
      uptime: this.formatTime(uptime),
      currentHeight: this.blockchain.chain.length - 1,
      pendingTransactions: this.blockchain.pendingTransactions.length,
      difficulty: this.blockchain.difficulty,
      miningReward: this.blockchain.miningReward
    };
  }

  /**
   * 更新难度
   */
  adjustDifficulty() {
    // 根据挖矿时间调整难度
    const targetTime = 10000; // 10秒目标时间
    const actualTime = this.getAverageBlockTime();
    
    if (actualTime < targetTime * 0.5) {
      this.blockchain.difficulty++;
      console.log(`🔼 难度增加到: ${this.blockchain.difficulty}`);
    } else if (actualTime > targetTime * 2) {
      this.blockchain.difficulty = Math.max(1, this.blockchain.difficulty - 1);
      console.log(`🔽 难度降低到: ${this.blockchain.difficulty}`);
    }
  }

  /**
   * 获取平均出块时间
   */
  getAverageBlockTime() {
    if (this.blockchain.chain.length < 2) return 10000;
    
    const recentBlocks = this.blockchain.chain.slice(-5); // 最近5个区块
    let totalTime = 0;
    
    for (let i = 1; i < recentBlocks.length; i++) {
      totalTime += recentBlocks[i].timestamp - recentBlocks[i-1].timestamp;
    }
    
    return totalTime / (recentBlocks.length - 1);
  }
}

// 如果作为主程序运行
if (import.meta.url === `file://${process.argv[1]}`) {
  const miner = new Miner();
  
  console.log('🚀 启动 Family Currency 挖矿程序...');
  
  // 处理退出信号
  process.on('SIGINT', () => {
    console.log('\n🛑 正在关闭挖矿程序...');
    miner.stop();
    process.exit(0);
  });
  
  process.on('SIGTERM', () => {
    console.log('\n🛑 正在关闭挖矿程序...');
    miner.stop();
    process.exit(0);
  });
  
  // 启动挖矿
  miner.start();
  
  // 每30秒调整一次难度
  setInterval(() => {
    miner.adjustDifficulty();
  }, 30000);
}

export { Miner };
