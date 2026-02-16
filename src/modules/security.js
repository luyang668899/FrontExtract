const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { dialog } = require('electron');

class Security {
  constructor() {
    this.maxFileSize = 1024 * 1024 * 100; // 100MB
    this.maxMemoryUsage = 2 * 1024 * 1024 * 1024; // 2GB
    this.tempDir = path.join(os.tmpdir(), 'fan-temp');
  }

  /**
   * 验证文件安全性
   * @param {string} filePath - 文件路径
   * @returns {Promise<object>} 验证结果
   */
  async validateFile(filePath) {
    try {
      // 检查文件是否存在
      if (!await fs.exists(filePath)) {
        return { valid: false, error: '文件不存在' };
      }

      // 检查文件大小
      const stats = await fs.stat(filePath);
      if (stats.size > this.maxFileSize) {
        return { valid: false, error: `文件过大，最大支持 ${this.formatSize(this.maxFileSize)}` };
      }

      // 检查文件扩展名
      const ext = path.extname(filePath).toLowerCase();
      const safeExtensions = [
        '.zip', '.rar', '.7z', '.tar', '.gz', '.asar',
        '.exe', '.dmg', '.deb', '.rpm',
        '.html', '.css', '.js', '.json'
      ];

      if (!safeExtensions.includes(ext)) {
        return { valid: false, error: '不支持的文件类型' };
      }

      // 检查文件路径是否安全（防止路径遍历攻击）
      const normalizedPath = path.normalize(filePath);
      if (!normalizedPath.startsWith(os.homedir()) && 
          !normalizedPath.startsWith(os.tmpdir()) && 
          !normalizedPath.startsWith('/Applications') && 
          !normalizedPath.startsWith('C:\\Program Files')) {
        return { valid: false, error: '文件路径不安全' };
      }

      return { valid: true };
    } catch (error) {
      return { valid: false, error: error.message };
    }
  }

  /**
   * 限制内存使用
   * @returns {boolean} 是否在安全范围内
   */
  checkMemoryUsage() {
    const used = process.memoryUsage();
    const totalUsed = used.heapUsed + used.external + used.arrayBuffers;
    return totalUsed < this.maxMemoryUsage;
  }

  /**
   * 清理临时文件
   */
  async cleanupTempFiles() {
    try {
      if (await fs.exists(this.tempDir)) {
        await fs.remove(this.tempDir);
      }
    } catch (error) {
      console.error('清理临时文件失败:', error);
    }
  }

  /**
   * 安全地读取文件
   * @param {string} filePath - 文件路径
   * @param {object} options - 选项
   * @returns {Promise<Buffer|string>} 文件内容
   */
  async safeReadFile(filePath, options = {}) {
    // 验证文件安全性
    const validation = await this.validateFile(filePath);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    // 限制文件大小
    const stats = await fs.stat(filePath);
    if (stats.size > this.maxFileSize) {
      throw new Error(`文件过大，最大支持 ${this.formatSize(this.maxFileSize)}`);
    }

    // 读取文件
    return await fs.readFile(filePath, options);
  }

  /**
   * 安全地写入文件
   * @param {string} filePath - 文件路径
   * @param {string|Buffer} content - 文件内容
   */
  async safeWriteFile(filePath, content) {
    // 验证目录权限
    const dirPath = path.dirname(filePath);
    if (!await fs.exists(dirPath)) {
      await fs.mkdir(dirPath, { recursive: true });
    }

    // 检查磁盘空间
    const { free } = await fs.diskSpace(dirPath);
    const contentSize = typeof content === 'string' ? content.length : content.byteLength;

    if (contentSize > free) {
      throw new Error('磁盘空间不足');
    }

    // 写入文件
    await fs.writeFile(filePath, content);
  }

  /**
   * 格式化文件大小
   * @param {number} bytes - 字节数
   * @returns {string} 格式化后的大小
   */
  formatSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * 显示安全警告
   * @param {BrowserWindow} window - 窗口
   * @param {string} message - 警告消息
   */
  showSecurityWarning(window, message) {
    dialog.showMessageBox(window, {
      type: 'warning',
      title: '安全警告',
      message: '安全警告',
      detail: message,
      buttons: ['确定']
    });
  }

  /**
   * 检查应用更新安全性
   * @param {string} updateUrl - 更新URL
   * @returns {boolean} 是否安全
   */
  validateUpdateUrl(updateUrl) {
    // 只允许HTTPS连接
    if (!updateUrl.startsWith('https://')) {
      return false;
    }

    // 可以添加更多检查，例如白名单域名等
    return true;
  }

  /**
   * 保护用户隐私
   * @param {object} data - 要处理的数据
   * @returns {object} 处理后的数据
   */
  protectPrivacy(data) {
    // 移除敏感信息
    const sensitiveKeys = ['password', 'token', 'secret', 'key', 'auth'];
    const result = { ...data };

    for (const key of sensitiveKeys) {
      if (result[key]) {
        result[key] = '***';
      }
    }

    return result;
  }

  /**
   * 验证输出目录安全性
   * @param {string} outputDir - 输出目录
   * @returns {Promise<boolean>} 是否安全
   */
  async validateOutputDir(outputDir) {
    try {
      // 检查目录是否存在
      if (!await fs.exists(outputDir)) {
        await fs.mkdir(outputDir, { recursive: true });
      }

      // 检查目录权限
      const testFile = path.join(outputDir, '.test-permission');
      await fs.writeFile(testFile, 'test');
      await fs.unlink(testFile);

      // 检查磁盘空间
      const { free } = await fs.diskSpace(outputDir);
      return free > 100 * 1024 * 1024; // 至少100MB
    } catch {
      return false;
    }
  }

  /**
   * 扫描文件安全性
   * @param {string} filePath - 文件路径
   * @returns {Promise<object>} 扫描结果
   */
  async scanFileSecurity(filePath) {
    try {
      const scanResult = {
        filePath,
        safe: true,
        warnings: [],
        errors: [],
        fileInfo: {
          size: 0,
          hash: '',
          extension: '',
          isExecutable: false
        },
        sourceInfo: {
          isKnownSource: false,
          sourceType: 'unknown',
          riskLevel: 'low'
        }
      };

      // 获取文件信息
      const stats = await fs.stat(filePath);
      scanResult.fileInfo.size = stats.size;
      scanResult.fileInfo.extension = path.extname(filePath).toLowerCase();
      scanResult.fileInfo.isExecutable = this._isExecutable(filePath);

      // 计算文件哈希
      scanResult.fileInfo.hash = await this.calculateFileHash(filePath);

      // 检查文件类型安全性
      await this._checkFileTypeSafety(filePath, scanResult);

      // 检查文件内容安全性
      await this._checkFileContentSafety(filePath, scanResult);

      // 检查文件来源
      await this._checkFileSource(filePath, scanResult);

      // 评估风险等级
      this._evaluateRiskLevel(scanResult);

      return scanResult;
    } catch (error) {
      return {
        filePath,
        safe: false,
        warnings: [],
        errors: [error.message],
        fileInfo: {},
        sourceInfo: {}
      };
    }
  }

  /**
   * 计算文件哈希
   * @param {string} filePath - 文件路径
   * @returns {Promise<string>} 文件哈希
   */
  async calculateFileHash(filePath) {
    return new Promise((resolve, reject) => {
      const hash = crypto.createHash('sha256');
      const stream = fs.createReadStream(filePath);

      stream.on('data', chunk => hash.update(chunk));
      stream.on('end', () => resolve(hash.digest('hex')));
      stream.on('error', reject);
    });
  }

  /**
   * 检查文件类型安全性
   * @param {string} filePath - 文件路径
   * @param {object} scanResult - 扫描结果
   * @private
   */
  async _checkFileTypeSafety(filePath, scanResult) {
    const ext = scanResult.fileInfo.extension;
    const executableExts = ['.exe', '.dmg', '.deb', '.rpm'];
    const archiveExts = ['.zip', '.rar', '.7z', '.tar', '.gz', '.asar'];

    if (executableExts.includes(ext)) {
      scanResult.warnings.push('可执行文件可能包含恶意代码');
      scanResult.sourceInfo.riskLevel = 'medium';
    }

    if (archiveExts.includes(ext)) {
      scanResult.warnings.push('压缩文件可能包含恶意文件');
      scanResult.sourceInfo.riskLevel = 'medium';
    }

    // 检查文件大小
    if (scanResult.fileInfo.size > this.maxFileSize) {
      scanResult.errors.push(`文件过大，可能包含恶意代码`);
      scanResult.safe = false;
    }
  }

  /**
   * 检查文件内容安全性
   * @param {string} filePath - 文件路径
   * @param {object} scanResult - 扫描结果
   * @private
   */
  async _checkFileContentSafety(filePath, scanResult) {
    // 对于文本文件，检查内容
    const textExts = ['.js', '.html', '.css', '.json'];
    if (textExts.includes(scanResult.fileInfo.extension)) {
      try {
        const content = await fs.readFile(filePath, 'utf8');
        
        // 检查恶意代码特征
        const maliciousPatterns = [
          'eval(',
          'Function(',
          'document.write(',
          'ActiveXObject',
          'XMLHttpRequest',
          'fetch(',
          'require("child_process")',
          'execSync(',
          'spawn(',
          'exec(' 
        ];

        for (const pattern of maliciousPatterns) {
          if (content.includes(pattern)) {
            scanResult.warnings.push(`文件包含潜在的恶意代码模式: ${pattern}`);
          }
        }
      } catch (error) {
        // 忽略文件读取错误
      }
    }
  }

  /**
   * 检查文件来源
   * @param {string} filePath - 文件路径
   * @param {object} scanResult - 扫描结果
   * @private
   */
  async _checkFileSource(filePath, scanResult) {
    const knownPaths = [
      os.homedir(),
      path.join(os.homedir(), 'Downloads'),
      path.join(os.homedir(), 'Desktop'),
      path.join(os.homedir(), 'Documents')
    ];

    // 检查文件是否来自已知路径
    const isKnownPath = knownPaths.some(knownPath => {
      return filePath.startsWith(knownPath);
    });

    if (isKnownPath) {
      scanResult.sourceInfo.isKnownSource = true;
      scanResult.sourceInfo.sourceType = 'local';
      scanResult.sourceInfo.riskLevel = 'low';
    } else {
      scanResult.sourceInfo.isKnownSource = false;
      scanResult.sourceInfo.sourceType = 'external';
      scanResult.sourceInfo.riskLevel = 'medium';
      scanResult.warnings.push('文件来自未知来源路径');
    }
  }

  /**
   * 评估风险等级
   * @param {object} scanResult - 扫描结果
   * @private
   */
  _evaluateRiskLevel(scanResult) {
    if (scanResult.errors.length > 0) {
      scanResult.sourceInfo.riskLevel = 'high';
      scanResult.safe = false;
    } else if (scanResult.warnings.length > 3) {
      scanResult.sourceInfo.riskLevel = 'high';
      scanResult.safe = false;
    } else if (scanResult.warnings.length > 0) {
      scanResult.sourceInfo.riskLevel = 'medium';
    }
  }

  /**
   * 检查文件是否为可执行文件
   * @param {string} filePath - 文件路径
   * @returns {boolean} 是否为可执行文件
   * @private
   */
  _isExecutable(filePath) {
    const executableExts = ['.exe', '.dmg', '.deb', '.rpm'];
    const ext = path.extname(filePath).toLowerCase();
    return executableExts.includes(ext);
  }

  /**
   * 记录文件来源
   * @param {string} filePath - 文件路径
   * @param {string} source - 来源信息
   * @returns {Promise<void>}
   */
  async recordFileSource(filePath, source) {
    try {
      const sourceRecord = {
        filePath,
        source,
        timestamp: new Date().toISOString(),
        hash: await this.calculateFileHash(filePath)
      };

      const recordsDir = path.join(os.homedir(), '.fan', 'source-records');
      await fs.ensureDir(recordsDir);

      const recordFile = path.join(recordsDir, `${Date.now()}.json`);
      await fs.writeJson(recordFile, sourceRecord);
    } catch (error) {
      console.error('记录文件来源失败:', error);
    }
  }

  /**
   * 获取文件安全建议
   * @param {object} scanResult - 扫描结果
   * @returns {array} 安全建议
   */
  getSecurityRecommendations(scanResult) {
    const recommendations = [];

    if (scanResult.sourceInfo.riskLevel === 'high') {
      recommendations.push('不建议处理此文件，可能包含恶意代码');
      recommendations.push('如需处理，请在隔离环境中进行');
    } else if (scanResult.sourceInfo.riskLevel === 'medium') {
      recommendations.push('建议在处理前备份原始文件');
      recommendations.push('处理后请仔细检查提取的资源');
    } else {
      recommendations.push('文件看起来安全，可以正常处理');
    }

    if (scanResult.fileInfo.isExecutable) {
      recommendations.push('可执行文件可能包含安全风险，请谨慎处理');
    }

    return recommendations;
  }
}

// 导出单例
module.exports = new Security;