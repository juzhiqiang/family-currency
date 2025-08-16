import { Wallet } from '../crypto/Wallet.js';

class Miner {
  constructor() {
    this.wallet = Wallet.generate();
    this.isRunning = false;
    this.hashRate = 0;
    this.totalHashes = 0;
    this.blocksFound = 0;
    this.nodeUrl = process.env.NODE_URL || 'http://localhost:3001';
    this.miningReward = 100; // 默认挖矿奖励
    this.difficulty = 2; // 默认难度
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
    console.log(`💎 挖矿奖励: ${this.miningReward} FC`);
    console.log(`🔗 连接节点: ${this.nodeUrl}`);
    console.log('─'.repeat(60));

    // 开始挖矿循环
    this.miningLoop();

    // 每10秒显示一次挖矿统计
    this.statsInterval = setInterval(() => {
      this.displayStats();
    }, 10000);
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
        await this.sleep(2000);
      } catch (error) {
        console.error('❌ 挖矿过程中发生错误:', error.message);
        await this.sleep(10000); // 错误后等待10秒再继续
      }
    }
  }

  /**
   * 挖掘单个区块
   */
  async mineBlock() {
    try {
      // 首先获取挖矿信息
      const miningInfo = await this.getMiningInfo();
      if (!miningInfo) {
        console.log('❌ 无法连接到节点，等待重试...');
        await this.sleep(10000);
        return;
      }

      // 检查是否有待处理的交易
      if (miningInfo.pendingTransactions === 0) {
        console.log('📑 暂无待处理交易，等待中...');
        await this.sleep(10000);
        return;
      }

      console.log(`⛏️  开始挖掘新区块 (难度: ${miningInfo.difficulty}, 待处理交易: ${miningInfo.pendingTransactions})`);
      const startTime = Date.now();

      // 调用主节点的挖矿API
      const result = await this.callMineAPI();
      
      if (result && result.success && result.block) {
        const endTime = Date.now();
        const duration = (endTime - startTime) / 1000;
        
        this.blocksFound++;
        
        console.log('🎉 恭喜！挖到新区块!');
        console.log(`   区块高度: ${result.block.height || 'unknown'}`);
        console.log(`   区块哈希: ${result.block.hash}`);
        console.log(`   挖矿耗时: ${duration.toFixed(2)}秒`);
        console.log(`   获得奖励: ${this.miningReward} FC`);
        console.log('─'.repeat(60));
      } else if (result && !result.success) {
        console.log(`⚠️  ${result.message || '挖矿失败'}`);
      }
    } catch (error) {
      console.error('❌ 挖矿请求失败:', error.message);
    }
  }

  /**
   * 调用挖矿API
   */
  async callMineAPI() {
    try {
      const response = await fetch(`${this.nodeUrl}/api/mining/mine`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          minerAddress: this.wallet.getAddress()
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      throw new Error(`API调用失败: ${error.message}`);
    }
  }

  /**
   * 获取挖矿信息
   */
  async getMiningInfo() {
    try {
      const response = await fetch(`${this.nodeUrl}/api/mining/info`);
      if (!response.ok) {
        return null;
      }
      const result = await response.json();
      if (result.success) {
        // 更新本地缓存的信息
        this.difficulty = result.info.difficulty;
        this.miningReward = result.info.miningReward;
        return result.info;
      }
      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * 获取区块链统计信息
   */
  async getBlockchainStats() {
    try {
      const response = await fetch(`${this.nodeUrl}/api/blockchain/stats`);
      if (!response.ok) {
        return null;
      }
      const result = await response.json();
      return result.success ? result.stats : null;
    } catch (error) {
      return null;
    }
  }

  /**
   * 获取矿工余额
   */
  async getMinerBalance() {
    try {
      const response = await fetch(`${this.nodeUrl}/api/tokens/balance/${this.wallet.getAddress()}`);
      if (!response.ok) {
        return 0;
      }
      const result = await response.json();
      return result.success ? result.balance : 0;
    } catch (error) {
      return 0;
    }
  }

  /**
   * 显示挖矿统计信息
   */
  async displayStats() {
    const uptime = process.uptime();
    const balance = await this.getMinerBalance();
    const stats = await this.getBlockchainStats();
    
    console.log('📊 挖矿统计:');
    console.log(`   运行时间: ${this.formatTime(uptime)}`);
    console.log(`   已挖区块: ${this.blocksFound}`);
    console.log(`   当前余额: ${balance} FC`);
    console.log(`   矿工地址: ${this.wallet.getAddress().substring(0, 20)}...`);
    
    if (stats) {
      console.log(`   区块高度: ${stats.height}`);
      console.log(`   待处理TX: ${stats.pendingTransactions}`);
      console.log(`   挖矿难度: ${stats.difficulty}`);
      console.log(`   网络状态: ${stats.isValid ? '✅ 正常' : '❌ 异常'}`);
    } else {
      console.log(`   网络状态: ❌ 连接失败`);
    }
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
   * 检查节点连接
   */
  async checkNodeConnection() {
    try {
      const response = await fetch(`${this.nodeUrl}/health`);
      return response.ok;
    } catch (error) {
      return false;
    }
  }

  /**
   * 获取挖矿信息
   */
  async getInfo() {
    const uptime = process.uptime();
    const balance = await this.getMinerBalance();
    const stats = await this.getBlockchainStats();
    const connected = await this.checkNodeConnection();
    
    return {
      isRunning: this.isRunning,
      minerAddress: this.wallet.getAddress(),
      balance: balance,
      blocksFound: this.blocksFound,
      uptime: this.formatTime(uptime),
      currentHeight: stats ? stats.height : 'unknown',
      pendingTransactions: stats ? stats.pendingTransactions : 'unknown',
      difficulty: stats ? stats.difficulty : 'unknown',
      miningReward: this.miningReward,
      nodeConnected: connected,
      nodeUrl: this.nodeUrl
    };
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
  
  // 等待一下再启动，确保主节点已经启动
  setTimeout(async () => {
    // 检查节点连接
    const connected = await miner.checkNodeConnection();
    if (!connected) {
      console.log('❌ 无法连接到主节点，请确保主节点已启动 (npm start)');
      console.log(`   尝试连接: ${miner.nodeUrl}`);
      console.log('   等待节点启动...');
    }
    
    // 启动挖矿
    miner.start();
  }, 2000);
}

export { Miner };
