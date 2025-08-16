# Family Currency - 家庭币

基于 Cosmos SDK 开发的家庭导向加密货币区块链系统

## 功能特性

- 🪙 **代币生产**: 支持代币的铸造和发行
- 👥 **用户管理**: 创建和管理用户账户
- 💸 **代币转账**: 安全的点对点代币转账
- ⛏️ **矿工系统**: 完整的区块挖矿机制
- 🔍 **区块链浏览器**: 实时查看区块高度和区块信息

## 快速开始

### 安装依赖
```bash
npm install
```

### 启动主链
```bash
npm start
```

### 启动区块链浏览器
```bash
npm run explorer
```
浏览器访问: http://localhost:3000

### 启动挖矿程序
```bash
npm run miner
```

### 运行测试
```bash
npm test
```

## API 接口

### 用户管理
- `POST /api/users/create` - 创建新用户
- `GET /api/users/:address` - 获取用户信息

### 代币操作
- `POST /api/tokens/mint` - 铸造代币
- `POST /api/tokens/transfer` - 转账代币
- `GET /api/tokens/balance/:address` - 查询余额

### 区块链信息
- `GET /api/blockchain/height` - 获取当前区块高度
- `GET /api/blockchain/block/:height` - 获取指定区块信息
- `GET /api/blockchain/latest` - 获取最新区块

## 架构说明

```
src/
├── blockchain/          # 区块链核心逻辑
│   ├── Block.js        # 区块结构
│   ├── Blockchain.js   # 区块链主类
│   └── Transaction.js  # 交易结构
├── consensus/          # 共识机制
│   └── ProofOfWork.js  # 工作量证明
├── crypto/            # 加密相关
│   └── Wallet.js      # 钱包管理
├── explorer/          # 区块链浏览器
│   ├── server.js      # 浏览器服务器
│   └── public/        # 前端页面
├── miner/             # 挖矿程序
│   └── miner.js       # 挖矿逻辑
├── network/           # 网络层
│   └── P2PNetwork.js  # 点对点网络
└── api/               # API 接口
    └── routes.js      # 路由定义
```

## 技术栈

- **区块链**: Cosmos SDK (JavaScript)
- **共识算法**: Proof of Work (工作量证明)
- **加密**: SHA-256, ECDSA
- **网络**: WebSocket (P2P)
- **前端**: HTML5 + JavaScript
- **后端**: Node.js + Express

## 贡献

欢迎提交 Issue 和 Pull Request！

## 许可证

MIT License
