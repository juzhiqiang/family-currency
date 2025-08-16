import express from 'express';
import { WebSocketServer } from 'ws';
import { Blockchain } from './blockchain/Blockchain.js';
import { setupRoutes } from './api/routes.js';
import { P2PNetwork } from './network/P2PNetwork.js';

const app = express();
const PORT = process.env.PORT || 3001;

// 创建区块链实例
const blockchain = new Blockchain();

// 创建 WebSocket 服务器用于 P2P 网络
const wss = new WebSocketServer({ port: 6001 });

// 创建 P2P 网络
const p2pNetwork = new P2PNetwork(blockchain, wss);

// 中间件
app.use(express.json());
app.use(express.static('public'));

// 设置路由
setupRoutes(app, blockchain, p2pNetwork);

// 启动服务器
app.listen(PORT, () => {
  console.log(`🚀 Family Currency 区块链节点启动成功!`);
  console.log(`📡 HTTP API 服务: http://localhost:${PORT}`);
  console.log(`🔗 P2P 网络监听: ws://localhost:6001`);
  console.log(`⛏️  开始挖矿...`);
  
  // 开始挖矿
  setInterval(() => {
    blockchain.minePendingTransactions('miner-address');
  }, 10000); // 每10秒尝试挖一个块
});

// 优雅关闭
process.on('SIGINT', () => {
  console.log('\n🛑 正在关闭 Family Currency 节点...');
  process.exit(0);
});
