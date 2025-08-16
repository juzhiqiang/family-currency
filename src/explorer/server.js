import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { Blockchain } from '../blockchain/Blockchain.js';
import { WebSocketServer } from 'ws';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.EXPLORER_PORT || 3000;

// 创建区块链实例
const blockchain = new Blockchain();

// WebSocket 服务器用于实时更新
const wss = new WebSocketServer({ port: 3001 });

// 中间件
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ============ 区块链浏览器 API ============

/**
 * 获取区块链概览
 */
app.get('/api/explorer/overview', (req, res) => {
  try {
    const stats = blockchain.getStats();
    const latestBlocks = blockchain.chain
      .slice(-5)
      .reverse()
      .map((block, index) => ({
        height: blockchain.chain.length - 1 - index,
        hash: block.hash,
        timestamp: block.timestamp,
        transactionCount: block.transactions.length,
        miner: block.miner,
        size: block.getSize()
      }));

    res.json({
      success: true,
      overview: {
        ...stats,
        latestBlocks
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
app.get('/api/explorer/blocks', (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const startIndex = Math.max(0, blockchain.chain.length - (page * limit));
    const endIndex = Math.max(0, blockchain.chain.length - ((page - 1) * limit));
    
    const blocks = blockchain.chain
      .slice(startIndex, endIndex)
      .reverse()
      .map((block, index) => ({
        height: endIndex - 1 - index,
        hash: block.hash,
        previousHash: block.previousHash,
        timestamp: block.timestamp,
        transactionCount: block.transactions.length,
        miner: block.miner,
        nonce: block.nonce,
        size: block.getSize()
      }));

    res.json({
      success: true,
      blocks,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(blockchain.chain.length / limit),
        totalBlocks: blockchain.chain.length,
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
app.get('/api/explorer/transactions', (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    
    // 收集所有交易
    const allTransactions = [];
    blockchain.chain.forEach((block, blockIndex) => {
      block.transactions.forEach(tx => {
        allTransactions.push({
          ...tx.toJSON(),
          blockHeight: blockIndex,
          blockHash: block.hash,
          blockTimestamp: block.timestamp
        });
      });
    });
    
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
app.get('/api/explorer/search/:query', (req, res) => {
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
      const block = blockchain.getBlockByHeight(height);
      if (block) {
        results.blocks.push({
          height,
          hash: block.hash,
          timestamp: block.timestamp,
          transactionCount: block.transactions.length
        });
      }
    }
    
    // 搜索哈希（区块或交易）
    if (/^[a-fA-F0-9]{64}$/.test(query)) {
      // 搜索区块哈希
      const block = blockchain.getBlockByHash(query);
      if (block) {
        const height = blockchain.chain.indexOf(block);
        results.blocks.push({
          height,
          hash: block.hash,
          timestamp: block.timestamp,
          transactionCount: block.transactions.length
        });
      }
      
      // 搜索交易哈希
      const transaction = blockchain.getTransaction(query);
      if (transaction) {
        results.transactions.push(transaction);
      }
    }
    
    // 搜索地址
    if (query.length > 0) {
      const balance = blockchain.getBalance(query);
      if (balance > 0) {
        const transactions = blockchain.getAllTransactionsForWallet(query);
        results.addresses.push({
          address: query,
          balance,
          transactionCount: transactions.length
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
app.get('/api/explorer/address/:address', (req, res) => {
  try {
    const address = req.params.address;
    const balance = blockchain.getBalance(address);
    const transactions = blockchain.getAllTransactionsForWallet(address);
    
    // 计算统计信息
    let totalReceived = 0;
    let totalSent = 0;
    
    transactions.forEach(tx => {
      if (tx.toAddress === address) {
        totalReceived += tx.amount;
      }
      if (tx.fromAddress === address) {
        totalSent += tx.amount + tx.fee;
      }
    });

    res.json({
      success: true,
      address: {
        address,
        balance,
        totalReceived,
        totalSent,
        transactionCount: transactions.length,
        firstSeen: transactions.length > 0 ? Math.min(...transactions.map(tx => tx.timestamp)) : null,
        lastSeen: transactions.length > 0 ? Math.max(...transactions.map(tx => tx.timestamp)) : null,
        transactions: transactions.slice(-20) // 最近20笔交易
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
wss.on('connection', (ws) => {
  console.log('🔌 浏览器客户端连接');
  
  // 发送初始数据
  ws.send(JSON.stringify({
    type: 'INITIAL_DATA',
    data: {
      stats: blockchain.getStats(),
      latestBlock: blockchain.getLatestBlock().toJSON()
    }
  }));
  
  ws.on('close', () => {
    console.log('🔌 浏览器客户端断开连接');
  });
});

// 定时广播更新
setInterval(() => {
  const message = JSON.stringify({
    type: 'STATS_UPDATE',
    data: {
      stats: blockchain.getStats(),
      latestBlock: blockchain.getLatestBlock().toJSON()
    }
  });
  
  wss.clients.forEach(client => {
    if (client.readyState === 1) { // WebSocket.OPEN
      client.send(message);
    }
  });
}, 5000); // 每5秒更新一次

// 启动服务器
app.listen(PORT, () => {
  console.log(`🌐 Family Currency 区块链浏览器启动!`);
  console.log(`📡 浏览器地址: http://localhost:${PORT}`);
  console.log(`🔌 WebSocket: ws://localhost:3001`);
});

// 优雅关闭
process.on('SIGINT', () => {
  console.log('\n🛑 正在关闭浏览器服务器...');
  wss.close();
  process.exit(0);
});
