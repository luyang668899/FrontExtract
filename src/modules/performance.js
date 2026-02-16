const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

class PerformanceOptimizer {
  constructor() {
    this.cacheDir = path.join(os.tmpdir(), 'fan-cache');
    this.maxCacheSize = 1024 * 1024 * 100; // 100MB
    this.fileCache = new Map();
    this.maxCacheEntries = 100; // 最大缓存条目数
    this.memoryUsageThreshold = 80; // 内存使用阈值（百分比）
    this.initCache();
  }

  /**
   * 初始化缓存目录
   */
  async initCache() {
    try {
      await fs.ensureDir(this.cacheDir);
      await this.cleanupCache();
    } catch (error) {
      console.error('初始化缓存失败:', error);
    }
  }

  /**
   * 清理缓存
   */
  async cleanupCache() {
    try {
      const files = await fs.readdir(this.cacheDir);
      let totalSize = 0;
      const fileStats = [];

      for (const file of files) {
        const filePath = path.join(this.cacheDir, file);
        const stats = await fs.stat(filePath);
        totalSize += stats.size;
        fileStats.push({ path: filePath, size: stats.size, mtime: stats.mtime });
      }

      // 如果缓存超过最大大小，删除最旧的文件
      if (totalSize > this.maxCacheSize) {
        fileStats.sort((a, b) => a.mtime - b.mtime);
        let deletedSize = 0;

        for (const file of fileStats) {
          if (totalSize - deletedSize > this.maxCacheSize) {
            await fs.unlink(file.path);
            deletedSize += file.size;
          } else {
            break;
          }
        }
      }
    } catch (error) {
      console.error('清理缓存失败:', error);
    }
  }

  /**
   * 并行处理文件
   * @param {array} files - 文件路径数组
   * @param {function} processor - 处理函数
   * @param {number} concurrency - 并发数
   * @returns {Promise<array>} 处理结果
   */
  async parallelProcess(files, processor, concurrency = os.cpus().length) {
    const results = [];
    const queue = [...files];
    const activeWorkers = [];

    while (queue.length > 0 || activeWorkers.length > 0) {
      if (activeWorkers.length < concurrency && queue.length > 0) {
        const file = queue.shift();
        const worker = processor(file).then(result => {
          results.push(result);
          const index = activeWorkers.indexOf(worker);
          if (index > -1) {
            activeWorkers.splice(index, 1);
          }
        });
        activeWorkers.push(worker);
      } else {
        await Promise.race(activeWorkers);
      }
    }

    return results;
  }

  /**
   * 流式读取文件
   * @param {string} filePath - 文件路径
   * @returns {Promise<string>} 文件内容
   */
  async streamReadFile(filePath) {
    return new Promise((resolve, reject) => {
      const chunks = [];
      const stream = fs.createReadStream(filePath, { encoding: 'utf8' });

      stream.on('data', chunk => chunks.push(chunk));
      stream.on('end', () => resolve(chunks.join('')));
      stream.on('error', reject);
    });
  }

  /**
   * 流式写入文件
   * @param {string} filePath - 文件路径
   * @param {string} content - 文件内容
   * @returns {Promise<void>}
   */
  async streamWriteFile(filePath, content) {
    return new Promise((resolve, reject) => {
      const stream = fs.createWriteStream(filePath);
      stream.write(content);
      stream.end(resolve);
      stream.on('error', reject);
    });
  }

  /**
   * 缓存文件内容
   * @param {string} filePath - 文件路径
   * @param {string} content - 文件内容
   */
  cacheFile(filePath, content) {
    // 检查内存使用情况
    if (this.isMemoryUsageHigh()) {
      this.clearMemoryCache();
    }

    // 检查缓存大小
    if (this.fileCache.size >= this.maxCacheEntries) {
      this.evictOldestCacheEntry();
    }

    const cacheKey = this.getCacheKey(filePath);
    this.fileCache.set(cacheKey, {
      content,
      timestamp: Date.now(),
      size: content.length
    });
  }

  /**
   * 检查内存使用是否过高
   * @returns {boolean} 内存使用是否过高
   */
  isMemoryUsageHigh() {
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;
    const usagePercentage = (usedMemory / totalMemory) * 100;
    return usagePercentage > this.memoryUsageThreshold;
  }

  /**
   * 清理内存缓存
   */
  clearMemoryCache() {
    this.fileCache.clear();
  }

  /**
   * 移除最旧的缓存条目
   */
  evictOldestCacheEntry() {
    if (this.fileCache.size === 0) return;

    let oldestKey = null;
    let oldestTimestamp = Infinity;

    for (const [key, value] of this.fileCache.entries()) {
      if (value.timestamp < oldestTimestamp) {
        oldestTimestamp = value.timestamp;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.fileCache.delete(oldestKey);
    }
  }

  /**
   * 获取缓存的文件内容
   * @param {string} filePath - 文件路径
   * @returns {string|null} 缓存的内容
   */
  getCachedFile(filePath) {
    const cacheKey = this.getCacheKey(filePath);
    const cachedItem = this.fileCache.get(cacheKey);
    return cachedItem ? cachedItem.content : null;
  }

  /**
   * 生成缓存键
   * @param {string} filePath - 文件路径
   * @returns {string} 缓存键
   */
  getCacheKey(filePath) {
    // 基于文件路径生成缓存键，确保相同文件使用相同的缓存键
    return filePath;
  }

  /**
   * 智能清理内存缓存
   * 根据内存使用情况和缓存大小进行清理
   * @param {number} percentage - 清理比例（0-100）
   */
  smartClearMemoryCache(percentage = 50) {
    if (this.fileCache.size === 0) return;

    const totalEntries = this.fileCache.size;
    const entriesToRemove = Math.ceil(totalEntries * (percentage / 100));

    // 获取所有缓存条目并按时间戳排序
    const entries = Array.from(this.fileCache.entries());
    entries.sort((a, b) => a[1].timestamp - b[1].timestamp);

    // 移除最旧的条目
    for (let i = 0; i < entriesToRemove; i++) {
      if (i < entries.length) {
        this.fileCache.delete(entries[i][0]);
      }
    }

    return {
      total: totalEntries,
      removed: entriesToRemove,
      remaining: this.fileCache.size
    };
  }

  /**
   * 获取缓存使用情况
   * @returns {object} 缓存使用情况
   */
  getCacheStats() {
    const totalSize = Array.from(this.fileCache.values()).reduce((sum, item) => sum + item.size, 0);
    return {
      entries: this.fileCache.size,
      totalSize,
      maxEntries: this.maxCacheEntries
    };
  }

  /**
   * 计算文件哈希
   * @param {string} filePath - 文件路径
   * @returns {Promise<string>} 文件哈希
   */
  async getFileHash(filePath) {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);

    return new Promise((resolve, reject) => {
      stream.on('data', chunk => hash.update(chunk));
      stream.on('end', () => resolve(hash.digest('hex')));
      stream.on('error', reject);
    });
  }

  /**
   * 批量重命名文件
   * @param {array} renameMap - 重命名映射数组
   * @returns {Promise<void>}
   */
  async batchRename(renameMap) {
    await this.parallelProcess(renameMap, async (item) => {
      await fs.rename(item.from, item.to);
    });
  }

  /**
   * 批量复制文件
   * @param {array} copyMap - 复制映射数组
   * @returns {Promise<void>}
   */
  async batchCopy(copyMap) {
    await this.parallelProcess(copyMap, async (item) => {
      await fs.copy(item.from, item.to);
    });
  }

  /**
   * 批量删除文件
   * @param {array} files - 文件路径数组
   * @returns {Promise<void>}
   */
  async batchDelete(files) {
    await this.parallelProcess(files, async (file) => {
      await fs.remove(file);
    });
  }

  /**
   * 临时文件管理类
   */
  get tempFileManager() {
    if (!this._tempFileManager) {
      this._tempFileManager = new TempFileManager();
    }
    return this._tempFileManager;
  }
}

/**
 * 临时文件管理器
 * 负责临时文件的创建、跟踪和自动清理
 */
class TempFileManager {
  constructor() {
    this.tempFiles = [];
    this.cleanupInterval = null;
    this.cleanupIntervalTime = 24 * 60 * 60 * 1000; // 24小时
    this.maxTempFileAge = 7 * 24 * 60 * 60 * 1000; // 7天
    this.init();
  }

  /**
   * 初始化临时文件管理器
   */
  init() {
    // 启动定期清理
    this.startCleanupInterval();
    // 初始清理
    this.cleanupTempFiles();
  }

  /**
   * 启动定期清理
   */
  startCleanupInterval() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.cleanupInterval = setInterval(() => {
      this.cleanupTempFiles();
    }, this.cleanupIntervalTime);
  }

  /**
   * 停止定期清理
   */
  stopCleanupInterval() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * 注册临时文件
   * @param {string} filePath - 临时文件路径
   */
  registerTempFile(filePath) {
    this.tempFiles.push({
      path: filePath,
      created: Date.now()
    });
  }

  /**
   * 清理临时文件
   */
  async cleanupTempFiles() {
    try {
      const now = Date.now();
      const filesToClean = this.tempFiles.filter(file => {
        return now - file.created > this.maxTempFileAge;
      });

      if (filesToClean.length > 0) {
        console.log(`清理 ${filesToClean.length} 个过期临时文件`);
        
        for (const file of filesToClean) {
          try {
            if (fs.existsSync(file.path)) {
              await fs.remove(file.path);
              console.log(`清理临时文件: ${file.path}`);
            }
          } catch (error) {
            console.error(`清理临时文件失败 ${file.path}:`, error);
          }
        }

        // 更新临时文件列表
        this.tempFiles = this.tempFiles.filter(file => {
          return now - file.created <= this.maxTempFileAge;
        });
      }

      // 清理系统临时目录中的FrontExtract临时文件
      await this.cleanupSystemTempFiles();
    } catch (error) {
      console.error('清理临时文件失败:', error);
    }
  }

  /**
   * 清理系统临时目录中的FrontExtract临时文件
   */
  async cleanupSystemTempFiles() {
    try {
      const tempDir = os.tmpdir();
      const entries = await fs.readdir(tempDir);
      const now = Date.now();

      for (const entry of entries) {
        if (entry.startsWith('fan-temp') || entry.startsWith('dmg-mount-')) {
          const entryPath = path.join(tempDir, entry);
          try {
            const stats = await fs.stat(entryPath);
            // 清理超过24小时的临时目录
            if (now - stats.mtimeMs > 24 * 60 * 60 * 1000) {
              await fs.remove(entryPath);
              console.log(`清理系统临时目录: ${entryPath}`);
            }
          } catch (error) {
            console.error(`清理系统临时目录失败 ${entryPath}:`, error);
          }
        }
      }
    } catch (error) {
      console.error('清理系统临时文件失败:', error);
    }
  }

  /**
   * 获取临时文件统计信息
   * @returns {object} 统计信息
   */
  getStats() {
    const now = Date.now();
    const total = this.tempFiles.length;
    const expired = this.tempFiles.filter(file => now - file.created > this.maxTempFileAge).length;
    
    return {
      total,
      expired,
      maxAge: this.maxTempFileAge,
      cleanupInterval: this.cleanupIntervalTime
    };
  }

  /**
   * 手动清理所有临时文件
   */
  async manualCleanup() {
    try {
      console.log('执行手动清理所有临时文件');
      
      // 清理所有注册的临时文件
      for (const file of this.tempFiles) {
        try {
          if (fs.existsSync(file.path)) {
            await fs.remove(file.path);
            console.log(`清理临时文件: ${file.path}`);
          }
        } catch (error) {
          console.error(`清理临时文件失败 ${file.path}:`, error);
        }
      }
      
      // 清空临时文件列表
      this.tempFiles = [];
      
      // 清理系统临时目录
      await this.cleanupSystemTempFiles();
      
      console.log('手动清理完成');
    } catch (error) {
      console.error('手动清理临时文件失败:', error);
    }
  }
}


// 导出单例
module.exports = new PerformanceOptimizer;