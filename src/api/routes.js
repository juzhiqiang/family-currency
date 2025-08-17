import { Transaction } from '../blockchain/Transaction.js';
import { Wallet } from '../crypto/Wallet.js';

export function setupRoutes(app, blockchain, p2pNetwork) {
  
  // 健康检查
  app.get('/health', (req, res) => {
    res.json({ status: 'OK', timestamp: Date.now() });
  });

  // ============ 用户管理 API ============
  
  /**
   * 创建新用户
   */
  app.post('/api/users/create', (req, res) => {
    try {
      const { name } = req.body;
      const wallet = Wallet.generate();
      
      const user = {
        name: name || `User_${Date.now()}`,
        address: wallet.getAddress(),
        publicKey: wallet.publicKey,
        privateKey: wallet.privateKey, // 生产环境中不应返回私钥
        createdAt: new Date().toISOString(),
        balance: blockchain.getBalance(wallet.getAddress())
      };
      
      res.json({
        success: true,
        message: '用户创建成功',
        user
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: '创建用户失败',
        error: error.message
      });
    }
  });

  /**
   * 获取用户信息
   */
  app.get('/api/users/:address', (req, res) => {
    try {
      const { address } = req.params;
      const balance = blockchain.getBalance(address);
      const transactions = blockchain.getAllTransactionsForWallet(address);
      
      res.json({
        success: true,
        user: {
          address,
          balance,
          transactionCount: transactions.length,
          transactions: transactions.slice(-10) // 最近10笔交易
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: '获取用户信息失败',
        error: error.message
      });
    }
  });

  // ============ 代币操作 API ============
  
  /**
   * 铸造代币
   */
  app.post('/api/tokens/mint', (req, res) => {
    try {
      const { toAddress, amount } = req.body;
      
      if (!toAddress || !amount || amount <= 0) {
        return res.status(400).json({
          success: false,
          message: '参数无效：需要有效的接收地址和数量'
        });
      }

      const mintTx = Transaction.createMintTransaction(toAddress, amount);
      blockchain.createTransaction(mintTx);
      
      res.json({
        success: true,
        message: '代币铸造交易已提交',
        transaction: mintTx.toJSON()
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: '铸造代币失败',
        error: error.message
      });
    }
  });

  /**
   * 转账代币
   */
  app.post('/api/tokens/transfer', (req, res) => {
    try {
      const { fromAddress, toAddress, amount, privateKey } = req.body;
      
      if (!fromAddress || !toAddress || !amount || !privateKey || amount <= 0) {
        return res.status(400).json({
          success: false,
          message: '参数无效：需要发送方地址、接收方地址、转账数量和私钥'
        });
      }

      const transferTx = Transaction.createTransferTransaction(fromAddress, toAddress, amount);
      transferTx.signTransaction(privateKey);
      blockchain.createTransaction(transferTx);
      
      res.json({
        success: true,
        message: '转账交易已提交',
        transaction: transferTx.toJSON()
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: '转账失败',
        error: error.message
      });
    }
  });

  /**
   * 查询余额
   */
  app.get('/api/tokens/balance/:address', (req, res) => {
    try {
      const { address } = req.params;
      const balance = blockchain.getBalance(address);
      
      res.json({
        success: true,
        address,
        balance
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: '查询余额失败',
        error: error.message
      });
    }
  });

  // ============ 区块链信息 API ============
  
  /**
   * 获取当前区块高度
   */
  app.get('/api/blockchain/height', (req, res) => {
    try {
      const height = blockchain.chain.length - 1;
      res.json({
        success: true,
        height,
        totalBlocks: blockchain.chain.length
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: '获取区块高度失败',
        error: error.message
      });
    }
  });

  /**
   * 获取指定区块信息
   */
  app.get('/api/blockchain/block/:height', (req, res) => {
    try {
      const height = parseInt(req.params.height);
      const block = blockchain.getBlockByHeight(height);
      
      if (!block) {
        return res.status(404).json({
          success: false,
          message: '区块不存在'
        });
      }
      
      res.json({
        success: true,
        block: {
          height,
          ...block.toJSON()
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: '获取区块信息失败',
        error: error.message
      });
    }
  });

  /**
   * 获取最新区块
   */
  app.get('/api/blockchain/latest', (req, res) => {
    try {
      const latestBlock = blockchain.getLatestBlock();
      const height = blockchain.chain.length - 1;
      
      res.json({
        success: true,
        block: {
          height,
          ...latestBlock.toJSON()
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: '获取最新区块失败',
        error: error.message
      });
    }
  });

  /**
   * 获取区块链统计信息
   */
  app.get('/api/blockchain/stats', (req, res) => {
    try {
      const stats = blockchain.getStats();
      res.json({
        success: true,
        stats
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: '获取统计信息失败',
        error: error.message
      });
    }
  });

  /**
   * 获取交易详情
   */
  app.get('/api/blockchain/transaction/:txId', (req, res) => {
    try {
      const { txId } = req.params;
      const transaction = blockchain.getTransaction(txId);
      
      if (!transaction) {
        return res.status(404).json({
          success: false,
          message: '交易不存在'
        });
      }
      
      res.json({
        success: true,
        transaction
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: '获取交易信息失败',
        error: error.message
      });
    }
  });

  /**
   * 获取待处理交易
   */
  app.get('/api/blockchain/pending', (req, res) => {
    try {
      res.json({
        success: true,
        pendingTransactions: blockchain.pendingTransactions.map(tx => tx.toJSON()),
        count: blockchain.pendingTransactions.length
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: '获取待处理交易失败',
        error: error.message
      });
    }
  });

  // ============ 挖矿 API ============
  
  /**
   * 手动触发挖矿
   */
  app.post('/api/mining/mine', (req, res) => {
    try {
      const { minerAddress } = req.body;
      
      if (!minerAddress) {
        return res.status(400).json({
          success: false,
          message: '需要提供矿工地址'
        });
      }

      const block = blockchain.minePendingTransactions(minerAddress);
      
      if (!block) {
        return res.json({
          success: true,
          message: '暂无待处理交易',
          block: null
        });
      }
      
      // 广播新区块到P2P网络
      if (p2pNetwork) {
        p2pNetwork.broadcastBlock(block);
      }
      
      res.json({
        success: true,
        message: '挖矿成功',
        block: block.toJSON()
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: '挖矿失败',
        error: error.message
      });
    }
  });

  /**
   * 获取挖矿信息
   */
  app.get('/api/mining/info', (req, res) => {
    try {
      res.json({
        success: true,
        info: {
          difficulty: blockchain.difficulty,
          miningReward: blockchain.miningReward,
          pendingTransactions: blockchain.pendingTransactions.length,
          estimatedTime: blockchain.pendingTransactions.length > 0 ? '10 seconds' : 'No pending transactions'
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: '获取挖矿信息失败',
        error: error.message
      });
    }
  });

  // ============ P2P 网络 API ============
  
  /**
   * 获取网络节点信息
   */
  app.get('/api/network/peers', (req, res) => {
    try {
      const peers = p2pNetwork ? p2pNetwork.getPeers() : [];
      res.json({
        success: true,
        peers,
        count: peers.length
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: '获取网络信息失败',
        error: error.message
      });
    }
  });

  /**
   * 连接到新节点
   */
  app.post('/api/network/connect', (req, res) => {
    try {
      const { peerUrl } = req.body;
      
      if (!peerUrl) {
        return res.status(400).json({
          success: false,
          message: '需要提供节点URL'
        });
      }

      if (p2pNetwork) {
        p2pNetwork.connectToPeer(peerUrl);
      }
      
      res.json({
        success: true,
        message: '正在连接到节点',
        peerUrl
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: '连接节点失败',
        error: error.message
      });
    }
  });
}
