import crypto from 'crypto';

export class Wallet {
  constructor() {
    this.keyPair = crypto.generateKeyPairSync('ec', {
      namedCurve: 'secp256k1',
      publicKeyEncoding: {
        type: 'spki',
        format: 'der'
      },
      privateKeyEncoding: {
        type: 'pkcs8',
        format: 'der'
      }
    });

    this.publicKey = this.keyPair.publicKey.toString('hex');
    this.privateKey = this.keyPair.privateKey.toString('hex');
  }

  /**
   * 获取钱包地址（公钥）
   */
  getAddress() {
    return this.publicKey;
  }

  /**
   * 获取私钥
   */
  getPrivateKey() {
    return this.privateKey;
  }

  /**
   * 从私钥推导公钥
   */
  static getPublicKeyFromPrivate(privateKeyHex) {
    try {
      const privateKey = Buffer.from(privateKeyHex, 'hex');
      const publicKey = crypto.createPublicKey({
        key: privateKey,
        format: 'der',
        type: 'pkcs8'
      });
      return publicKey.export({ type: 'spki', format: 'der' }).toString('hex');
    } catch (error) {
      // 简化处理：使用私钥哈希作为公钥标识
      return crypto.createHash('sha256').update(privateKeyHex).digest('hex');
    }
  }

  /**
   * 签名数据
   */
  static sign(data, privateKeyHex) {
    try {
      const privateKey = Buffer.from(privateKeyHex, 'hex');
      const sign = crypto.createSign('SHA256');
      sign.update(data);
      sign.end();
      
      const signature = sign.sign({
        key: privateKey,
        format: 'der',
        type: 'pkcs8'
      });
      
      return signature.toString('hex');
    } catch (error) {
      // 简化签名：使用 HMAC
      return crypto.createHmac('sha256', privateKeyHex).update(data).digest('hex');
    }
  }

  /**
   * 验证签名
   */
  static verify(data, signature, publicKeyHex) {
    try {
      const publicKey = Buffer.from(publicKeyHex, 'hex');
      const verify = crypto.createVerify('SHA256');
      verify.update(data);
      verify.end();
      
      return verify.verify({
        key: publicKey,
        format: 'der',
        type: 'spki'
      }, Buffer.from(signature, 'hex'));
    } catch (error) {
      // 简化验证：重新计算签名并比较
      const expectedSig = crypto.createHmac('sha256', publicKeyHex).update(data).digest('hex');
      return signature === expectedSig;
    }
  }

  /**
   * 创建钱包信息
   */
  getWalletInfo() {
    return {
      address: this.getAddress(),
      publicKey: this.publicKey,
      // 注意：在生产环境中，私钥不应该暴露
      privateKey: this.privateKey
    };
  }

  /**
   * 从私钥恢复钱包
   */
  static fromPrivateKey(privateKeyHex) {
    const wallet = new Wallet();
    wallet.privateKey = privateKeyHex;
    wallet.publicKey = this.getPublicKeyFromPrivate(privateKeyHex);
    return wallet;
  }

  /**
   * 生成随机钱包
   */
  static generate() {
    return new Wallet();
  }

  /**
   * 验证地址格式
   */
  static isValidAddress(address) {
    return typeof address === 'string' && address.length > 0;
  }
}
