import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer } from 'ws';
import { Wallet } from '../crypto/Wallet.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.EXPLORER_PORT || 3000;
const WS_PORT = process.env.EXPLORER_WS_PORT || 3002; // 修改WebSocket端口
const NODE_API_URL = process.env.NODE_API_URL || 'http://localhost:3001';

// 浏览器不再维护自己的区块链实例，而是从主节点获取数据

// 从主节点获取数据的辅助函数
async function fetchFromNode(endpoint, options = {}) {
  try {
    const response = await fetch(`${NODE_API_URL}${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      ...options
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    return await response.json();
  } catch (error) {
    console.error(`Failed to fetch from node: ${endpoint}`, error);
    return { success: false, error: error.message };
  }
}

// WebSocket 服务器用于实时更新 - 使用不同的端口
const wss = new WebSocketServer({ port: WS_PORT });

// 中间件
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ============ 钱包管理 API ============

/**
 * 生成新钱包
 */
app.post('/api/wallet/generate', (req, res) => {
  try {
    const wallet = Wallet.generate();
    const walletInfo = wallet.getWalletInfo();
    
    res.json({
      success: true,
      wallet: walletInfo,
      message: '新钱包生成成功'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '生成钱包失败',
      error: error.message
    });
  }
});

/**
 * 从私钥导入钱包
 */
app.post('/api/wallet/import', async (req, res) => {
  try {
    const { privateKey } = req.body;
    
    if (!privateKey) {
      return res.status(400).json({
        success: false,
        message: '私钥不能为空'
      });
    }

    // 从私钥恢复钱包
    const wallet = Wallet.fromPrivateKey(privateKey);
    const walletInfo = wallet.getWalletInfo();
    console.log(walletInfo)
    
    // 获取钱包地址对应的用户信息
    const userResult = await fetchFromNode(`/api/users/${walletInfo.address}`);
    
    let userInfo = null;
    if (userResult.success) {
      userInfo = userResult.user;
    }
    
    res.json({
      success: true,
      wallet: {
        ...walletInfo,
        // 如果用户存在，添加用户相关信息
        balance: userInfo ? userInfo.balance : 0,
        transactionCount: userInfo ? userInfo.transactionCount : 0,
        hasTransactions: userInfo ? userInfo.transactionCount > 0 : false
      },
      user: userInfo,
      message: '钱包导入成功'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '导入钱包失败',
      error: error.message
    });
  }
});

/**
 * 获取钱包余额
 */
app.get('/api/wallet/balance/:address', async (req, res) => {
  try {
    const { address } = req.params;
    
    const balanceResult = await fetchFromNode(`/api/tokens/balance/${address}`);
    
    if (balanceResult.success) {
      res.json({
        success: true,
        address,
        balance: balanceResult.balance
      });
    } else {
      res.status(404).json({
        success: false,
        message: '获取余额失败',
        error: balanceResult.error
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '获取余额失败',
      error: error.message
    });
  }
});

// ============ 挖矿 API ============

/**
 * 开始挖矿
 */
app.post('/api/mining/start', async (req, res) => {
  try {
    const { minerAddress } = req.body;
    
    if (!minerAddress) {
      return res.status(400).json({
        success: false,
        message: '矿工地址不能为空'
      });
    }

    // 调用主节点的挖矿API
    const miningResult = await fetchFromNode('/api/mining/mine', {
      method: 'POST',
      body: JSON.stringify({ miner: minerAddress })
    });

    if (miningResult.success) {
      res.json({
        success: true,
        message: '挖矿成功',
        block: miningResult.block,
        reward: miningResult.reward
      });
    } else {
      res.status(400).json({
        success: false,
        message: '挖矿失败',
        error: miningResult.error
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '挖矿失败',
      error: error.message
    });
  }
});

// ============ 交易 API ============

/**
 * 发送交易
 */
app.post('/api/transaction/send', async (req, res) => {
  try {
    const { fromAddress, toAddress, amount, privateKey } = req.body;
    
    // 验证必要参数
    if (!fromAddress || !toAddress || !amount || !privateKey) {
      return res.status(400).json({
        success: false,
        message: '请填写完整的交易信息（发送方地址、接收方地址、金额、私钥）'
      });
    }

    // 验证金额
    if (isNaN(amount) || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: '金额必须是大于0的数字'
      });
    }

    // 验证地址格式
    if (!Wallet.isValidAddress(fromAddress) || !Wallet.isValidAddress(toAddress)) {
      return res.status(400).json({
        success: false,
        message: '地址格式无效'
      });
    }

    // 验证私钥与发送方地址匹配
    try {
      const wallet = Wallet.fromPrivateKey(privateKey);
      if (wallet.getAddress() !== fromAddress) {
        return res.status(400).json({
          success: false,
          message: '私钥与发送方地址不匹配'
        });
      }
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: '无效的私钥格式'
      });
    }

    // 检查余额
    const balanceResult = await fetchFromNode(`/api/tokens/balance/${fromAddress}`);
    if (!balanceResult.success || balanceResult.balance < amount) {
      return res.status(400).json({
        success: false,
        message: '余额不足'
      });
    }

    // 发送交易到主节点
    const transactionResult = await fetchFromNode('/api/tokens/transfer', {
      method: 'POST',
      body: JSON.stringify({
        fromAddress,
        toAddress,
        amount: parseFloat(amount),
        privateKey
      })
    });

    if (transactionResult.success) {
      res.json({
        success: true,
        message: '交易发送成功',
        transaction: transactionResult.transaction,
        txId: transactionResult.txId
      });
    } else {
      res.status(400).json({
        success: false,
        message: '交易发送失败',
        error: transactionResult.error
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '交易发送失败',
      error: error.message
    });
  }
});

// ============ 区块链浏览器 API ============

/**
 * 获取区块链概览
 */
app.get('/api/explorer/overview', async (req, res) => {
  try {
    // 从主节点获取统计信息
    const statsResult = await fetchFromNode('/api/blockchain/stats');
    if (!statsResult.success) {
      throw new Error('无法获取区块链统计信息');
    }

    // 获取最新5个区块
    const latestBlocks = [];
    const currentHeight = statsResult.stats.height;
    
    for (let i = Math.max(0, currentHeight - 4); i <= currentHeight; i++) {
      const blockResult = await fetchFromNode(`/api/blockchain/block/${i}`);
      if (blockResult.success) {
        latestBlocks.push({
          height: blockResult.block.height,
          hash: blockResult.block.hash,
          timestamp: blockResult.block.timestamp,
          transactionCount: blockResult.block.transactions.length,
          miner: blockResult.block.miner,
          size: blockResult.block.size
        });
      }
    }

    res.json({
      success: true,
      overview: {
        ...statsResult.stats,
        latestBlocks: latestBlocks.reverse() // 最新的在前
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '获取概览信息失败',
      error: error.message
    });
  }
});

/**
 * 获取区块列表
 */
app.get('/api/explorer/blocks', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    
    // 获取总块数
    const statsResult = await fetchFromNode('/api/blockchain/stats');
    if (!statsResult.success) {
      throw new Error('无法获取区块链统计信息');
    }
    
    const totalBlocks = statsResult.stats.totalBlocks;
    const currentHeight = statsResult.stats.height;
    
    // 计算分页
    const startHeight = Math.max(0, currentHeight - (page * limit) + 1);
    const endHeight = Math.max(0, currentHeight - ((page - 1) * limit));
    
    const blocks = [];
    for (let height = endHeight; height >= startHeight; height--) {
      const blockResult = await fetchFromNode(`/api/blockchain/block/${height}`);
      if (blockResult.success) {
        blocks.push({
          height: blockResult.block.height,
          hash: blockResult.block.hash,
          previousHash: blockResult.block.previousHash,
          timestamp: blockResult.block.timestamp,
          transactionCount: blockResult.block.transactions.length,
          miner: blockResult.block.miner,
          nonce: blockResult.block.nonce,
          size: blockResult.block.size
        });
      }
    }

    res.json({
      success: true,
      blocks,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalBlocks / limit),
        totalBlocks: totalBlocks,
        limit
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '获取区块列表失败',
      error: error.message
    });
  }
});

/**
 * 获取交易列表
 */
app.get('/api/explorer/transactions', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    
    // 获取区块链统计信息
    const statsResult = await fetchFromNode('/api/blockchain/stats');
    if (!statsResult.success) {
      throw new Error('无法获取区块链统计信息');
    }
    
    // 收集所有交易
    const allTransactions = [];
    const currentHeight = statsResult.stats.height;
    
    for (let height = 0; height <= currentHeight; height++) {
      const blockResult = await fetchFromNode(`/api/blockchain/block/${height}`);
      if (blockResult.success) {
        blockResult.block.transactions.forEach(tx => {
          allTransactions.push({
            ...tx,
            blockHeight: height,
            blockHash: blockResult.block.hash,
            blockTimestamp: blockResult.block.timestamp
          });
        });
      }
    }
    
    // 按时间排序（最新的在前）
    allTransactions.sort((a, b) => b.timestamp - a.timestamp);
    
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const transactions = allTransactions.slice(startIndex, endIndex);

    res.json({
      success: true,
      transactions,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(allTransactions.length / limit),
        totalTransactions: allTransactions.length,
        limit
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '获取交易列表失败',
      error: error.message
    });
  }
});

/**
 * 搜索功能
 */
app.get('/api/explorer/search/:query', async (req, res) => {
  try {
    const query = req.params.query.trim();
    const results = {
      blocks: [],
      transactions: [],
      addresses: []
    };
    
    // 搜索区块
    if (/^\d+$/.test(query)) {
      const height = parseInt(query);
      const blockResult = await fetchFromNode(`/api/blockchain/block/${height}`);
      if (blockResult.success) {
        results.blocks.push({
          height,
          hash: blockResult.block.hash,
          timestamp: blockResult.block.timestamp,
          transactionCount: blockResult.block.transactions.length
        });
      }
    }
    
    // 搜索哈希（区块或交易）
    if (/^[a-fA-F0-9]{64}$/.test(query)) {
      // 搜索交易哈希
      const transactionResult = await fetchFromNode(`/api/blockchain/transaction/${query}`);
      if (transactionResult.success) {
        results.transactions.push(transactionResult.transaction);
      }
      
      // 如果没找到交易，尝试搜索区块哈希
      if (results.transactions.length === 0) {
        const statsResult = await fetchFromNode('/api/blockchain/stats');
        if (statsResult.success) {
          for (let height = 0; height <= statsResult.stats.height; height++) {
            const blockResult = await fetchFromNode(`/api/blockchain/block/${height}`);
            if (blockResult.success && blockResult.block.hash === query) {
              results.blocks.push({
                height,
                hash: blockResult.block.hash,
                timestamp: blockResult.block.timestamp,
                transactionCount: blockResult.block.transactions.length
              });
              break;
            }
          }
        }
      }
    }
    
    // 搜索地址
    if (query.length > 0) {
      const balanceResult = await fetchFromNode(`/api/tokens/balance/${query}`);
      if (balanceResult.success && balanceResult.balance > 0) {
        const userResult = await fetchFromNode(`/api/users/${query}`);
        const transactionCount = userResult.success ? userResult.user.transactionCount : 0;
        results.addresses.push({
          address: query,
          balance: balanceResult.balance,
          transactionCount
        });
      }
    }

    res.json({
      success: true,
      query,
      results,
      totalResults: results.blocks.length + results.transactions.length + results.addresses.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '搜索失败',
      error: error.message
    });
  }
});

/**
 * 获取地址详情
 */
app.get('/api/explorer/address/:address', async (req, res) => {
  try {
    const address = req.params.address;
    
    // 从主节点获取用户信息
    const userResult = await fetchFromNode(`/api/users/${address}`);
    if (!userResult.success) {
      return res.status(404).json({
        success: false,
        message: '地址不存在或无交易记录'
      });
    }
    
    const user = userResult.user;
    
    // 计算统计信息
    let totalReceived = 0;
    let totalSent = 0;
    
    user.transactions.forEach(tx => {
      if (tx.toAddress === address) {
        totalReceived += tx.amount;
      }
      if (tx.fromAddress === address) {
        totalSent += tx.amount + (tx.fee || 0);
      }
    });

    res.json({
      success: true,
      address: {
        address,
        balance: user.balance,
        totalReceived,
        totalSent,
        transactionCount: user.transactionCount,
        firstSeen: user.transactions.length > 0 ? Math.min(...user.transactions.map(tx => tx.timestamp)) : null,
        lastSeen: user.transactions.length > 0 ? Math.max(...user.transactions.map(tx => tx.timestamp)) : null,
        transactions: user.transactions.slice(-20) // 最近20笔交易
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '获取地址信息失败',
      error: error.message
    });
  }
});

// WebSocket 连接处理
wss.on('connection', async (ws) => {
  console.log('🔌 浏览器客户端连接');
  
  try {
    // 发送初始数据 - 从主节点获取
    const statsResult = await fetchFromNode('/api/blockchain/stats');
    const latestBlockResult = await fetchFromNode('/api/blockchain/latest');
    
    if (statsResult.success && latestBlockResult.success) {
      ws.send(JSON.stringify({
        type: 'INITIAL_DATA',
        data: {
          stats: statsResult.stats,
          latestBlock: latestBlockResult.block
        }
      }));
    }
  } catch (error) {
    console.error('发送初始数据失败:', error);
  }
  
  ws.on('close', () => {
    console.log('🔌 浏览器客户端断开连接');
  });
});

// 定时广播更新 - 从主节点获取数据
setInterval(async () => {
  try {
    const statsResult = await fetchFromNode('/api/blockchain/stats');
    const latestBlockResult = await fetchFromNode('/api/blockchain/latest');
    
    if (statsResult.success && latestBlockResult.success) {
      const message = JSON.stringify({
        type: 'STATS_UPDATE',
        data: {
          stats: statsResult.stats,
          latestBlock: latestBlockResult.block
        }
      });
      
      wss.clients.forEach(client => {
        if (client.readyState === 1) { // WebSocket.OPEN
          client.send(message);
        }
      });
    }
  } catch (error) {
    console.error('广播更新失败:', error);
  }
}, 5000); // 每5秒更新一次

// 启动服务器
app.listen(PORT, () => {
  console.log(`🌐 Family Currency 区块链浏览器启动!`);
  console.log(`📡 浏览器地址: http://localhost:${PORT}`);
  console.log(`🔌 WebSocket: ws://localhost:${WS_PORT}`);
});

// 优雅关闭
process.on('SIGINT', () => {
  console.log('\n🛑 正在关闭浏览器服务器...');
  wss.close();
  process.exit(0);
});
