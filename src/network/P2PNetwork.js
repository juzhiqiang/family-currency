import { WebSocket } from 'ws';

export class P2PNetwork {
  constructor(blockchain, wsServer) {
    this.blockchain = blockchain;
    this.sockets = [];
    this.wsServer = wsServer;
    this.setupWebSocketServer();
  }

  /**
   * 设置WebSocket服务器
   */
  setupWebSocketServer() {
    this.wsServer.on('connection', (ws) => {
      this.initConnection(ws);
    });
  }

  /**
   * 初始化连接
   */
  initConnection(ws) {
    this.sockets.push(ws);
    this.initMessageHandler(ws);
    this.initErrorHandler(ws);
    
    console.log(`🔗 新节点连接，当前连接数: ${this.sockets.length}`);
    
    // 发送当前区块链状态
    this.sendChain(ws);
  }

  /**
   * 初始化消息处理器
   */
  initMessageHandler(ws) {
    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        this.handleMessage(ws, message);
      } catch (error) {
        console.error('处理P2P消息失败:', error.message);
      }
    });
  }

  /**
   * 初始化错误处理器
   */
  initErrorHandler(ws) {
    const closeConnection = () => {
      this.sockets = this.sockets.filter(s => s !== ws);
      console.log(`🔌 节点断开连接，当前连接数: ${this.sockets.length}`);
    };
    
    ws.on('close', closeConnection);
    ws.on('error', closeConnection);
  }

  /**
   * 处理收到的消息
   */
  handleMessage(ws, message) {
    switch (message.type) {
      case 'QUERY_LATEST':
        this.sendLatestBlock(ws);
        break;
        
      case 'QUERY_ALL':
        this.sendChain(ws);
        break;
        
      case 'RESPONSE_BLOCKCHAIN':
        this.handleBlockchainResponse(message.data);
        break;
        
      case 'RESPONSE_LATEST_BLOCK':
        this.handleLatestBlockResponse(message.data);
        break;
        
      case 'NEW_TRANSACTION':
        this.handleNewTransaction(message.data);
        break;
        
      case 'NEW_BLOCK':
        this.handleNewBlock(message.data);
        break;
        
      default:
        console.log('未知消息类型:', message.type);
    }
  }

  /**
   * 处理区块链响应
   */
  handleBlockchainResponse(receivedBlocks) {
    if (receivedBlocks.length === 0) {
      console.log('收到空的区块链');
      return;
    }

    const latestBlockReceived = receivedBlocks[receivedBlocks.length - 1];
    const latestBlockHeld = this.blockchain.getLatestBlock();

    if (latestBlockReceived.timestamp > latestBlockHeld.timestamp) {
      console.log('🔄 收到更长的区块链，正在同步...');
      if (receivedBlocks.length === 1 && 
          latestBlockReceived.previousHash === latestBlockHeld.hash) {
        // 只需要添加一个新区块
        console.log('添加新区块到链中');
        this.blockchain.chain.push(latestBlockReceived);
      } else {
        // 需要替换整个链
        console.log('替换区块链');
        this.replaceChain(receivedBlocks);
      }
    } else {
      console.log('收到的区块链不是最新的');
    }
  }

  /**
   * 处理最新区块响应
   */
  handleLatestBlockResponse(receivedBlock) {
    const latestBlockHeld = this.blockchain.getLatestBlock();
    
    if (receivedBlock.timestamp > latestBlockHeld.timestamp) {
      if (receivedBlock.previousHash === latestBlockHeld.hash) {
        console.log('🆕 收到新区块，添加到链中');
        this.blockchain.chain.push(receivedBlock);
        this.broadcast({
          type: 'NEW_BLOCK',
          data: receivedBlock
        });
      } else {
        console.log('需要查询完整的区块链');
        this.broadcast({ type: 'QUERY_ALL' });
      }
    }
  }

  /**
   * 处理新交易
   */
  handleNewTransaction(transaction) {
    try {
      console.log('📨 收到新交易:', transaction.txId);
      // 这里可以添加交易验证逻辑
      // 如果验证通过，添加到待处理交易池
    } catch (error) {
      console.error('处理新交易失败:', error.message);
    }
  }

  /**
   * 处理新区块
   */
  handleNewBlock(block) {
    try {
      console.log('📦 收到新区块:', block.hash);
      this.handleLatestBlockResponse(block);
    } catch (error) {
      console.error('处理新区块失败:', error.message);
    }
  }

  /**
   * 替换区块链
   */
  replaceChain(newBlocks) {
    if (this.isValidChain(newBlocks) && newBlocks.length > this.blockchain.chain.length) {
      console.log('✅ 区块链验证通过，正在替换...');
      this.blockchain.chain = newBlocks;
      this.broadcast({
        type: 'RESPONSE_BLOCKCHAIN',
        data: this.blockchain.chain
      });
    } else {
      console.log('❌ 收到的区块链无效');
    }
  }

  /**
   * 验证区块链是否有效
   */
  isValidChain(chain) {
    // 简化的验证逻辑
    if (chain.length === 0) return false;
    
    for (let i = 1; i < chain.length; i++) {
      const currentBlock = chain[i];
      const previousBlock = chain[i - 1];
      
      if (currentBlock.previousHash !== previousBlock.hash) {
        return false;
      }
    }
    
    return true;
  }

  /**
   * 发送最新区块
   */
  sendLatestBlock(ws) {
    const message = {
      type: 'RESPONSE_LATEST_BLOCK',
      data: this.blockchain.getLatestBlock()
    };
    ws.send(JSON.stringify(message));
  }

  /**
   * 发送整个区块链
   */
  sendChain(ws) {
    const message = {
      type: 'RESPONSE_BLOCKCHAIN',
      data: this.blockchain.chain
    };
    ws.send(JSON.stringify(message));
  }

  /**
   * 广播消息到所有连接的节点
   */
  broadcast(message) {
    this.sockets.forEach(ws => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(message));
      }
    });
  }

  /**
   * 广播新交易
   */
  broadcastTransaction(transaction) {
    this.broadcast({
      type: 'NEW_TRANSACTION',
      data: transaction
    });
  }

  /**
   * 广播新区块
   */
  broadcastBlock(block) {
    this.broadcast({
      type: 'NEW_BLOCK',
      data: block
    });
  }

  /**
   * 连接到其他节点
   */
  connectToPeer(peerUrl) {
    try {
      const ws = new WebSocket(peerUrl);
      
      ws.on('open', () => {
        console.log(`🔗 成功连接到节点: ${peerUrl}`);
        this.initConnection(ws);
        
        // 请求最新区块
        ws.send(JSON.stringify({ type: 'QUERY_LATEST' }));
      });
      
      ws.on('error', (error) => {
        console.error(`连接节点失败 ${peerUrl}:`, error.message);
      });
      
    } catch (error) {
      console.error('连接节点时发生错误:', error.message);
    }
  }

  /**
   * 获取所有连接的节点
   */
  getPeers() {
    return this.sockets.map((ws, index) => ({
      id: index,
      readyState: ws.readyState,
      url: ws.url || 'unknown'
    }));
  }

  /**
   * 查询所有节点的最新区块
   */
  queryChainLengthMsg() {
    return { type: 'QUERY_LATEST' };
  }

  /**
   * 查询所有区块
   */
  queryAllMsg() {
    return { type: 'QUERY_ALL' };
  }
}
