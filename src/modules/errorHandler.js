const logger = require('./logger');

class ErrorHandler {
  constructor() {
    this.errorTypes = {
      FILE_NOT_FOUND: '文件不存在',
      UNSUPPORTED_FORMAT: '不支持的文件格式',
      UNPACK_FAILED: '解包失败',
      DECOMPILE_FAILED: '反编译失败',
      REORGANIZE_FAILED: '重组资源失败',
      PACK_FAILED: '生成前端包失败',
      PERMISSION_DENIED: '权限不足',
      DISK_FULL: '磁盘空间不足',
      NETWORK_ERROR: '网络错误',
      UNKNOWN_ERROR: '未知错误'
    };
  }

  /**
   * 分类错误
   * @param {Error} error - 错误对象
   * @returns {string} 错误类型
   */
  categorizeError(error) {
    const message = error.message.toLowerCase();

    if (message.includes('not found') || message.includes('不存在')) {
      return this.errorTypes.FILE_NOT_FOUND;
    } else if (message.includes('unsupported') || message.includes('不支持')) {
      return this.errorTypes.UNSUPPORTED_FORMAT;
    } else if (message.includes('unpack') || message.includes('解包')) {
      return this.errorTypes.UNPACK_FAILED;
    } else if (message.includes('decompile') || message.includes('反编译')) {
      return this.errorTypes.DECOMPILE_FAILED;
    } else if (message.includes('reorganize') || message.includes('重组')) {
      return this.errorTypes.REORGANIZE_FAILED;
    } else if (message.includes('pack') || message.includes('打包')) {
      return this.errorTypes.PACK_FAILED;
    } else if (message.includes('permission') || message.includes('权限')) {
      return this.errorTypes.PERMISSION_DENIED;
    } else if (message.includes('disk') || message.includes('空间')) {
      return this.errorTypes.DISK_FULL;
    } else if (message.includes('network') || message.includes('网络')) {
      return this.errorTypes.NETWORK_ERROR;
    } else {
      return this.errorTypes.UNKNOWN_ERROR;
    }
  }

  /**
   * 处理错误
   * @param {Error} error - 错误对象
   * @param {string} context - 错误上下文
   * @returns {object} 处理后的错误信息
   */
  async handleError(error, context = '') {
    const errorType = this.categorizeError(error);
    const errorInfo = {
      type: errorType,
      message: error.message,
      stack: error.stack,
      context
    };

    // 记录错误日志
    await logger.error(`[${context}] ${errorType}`, errorInfo);

    // 返回友好的错误信息
    return {
      success: false,
      error: {
        type: errorType,
        message: this.getFriendlyErrorMessage(errorType, error.message),
        originalMessage: error.message
      }
    };
  }

  /**
   * 获取友好的错误提示
   * @param {string} errorType - 错误类型
   * @param {string} originalMessage - 原始错误信息
   * @returns {string} 友好的错误提示
   */
  getFriendlyErrorMessage(errorType, originalMessage) {
    switch (errorType) {
      case this.errorTypes.FILE_NOT_FOUND:
        return '文件不存在或无法访问，请检查文件路径是否正确';
      case this.errorTypes.UNSUPPORTED_FORMAT:
        return '不支持的文件格式，请选择有效的软件包文件';
      case this.errorTypes.UNPACK_FAILED:
        return '解包失败，可能是文件损坏或格式不支持';
      case this.errorTypes.DECOMPILE_FAILED:
        return '反编译失败，可能是代码结构复杂或加密保护';
      case this.errorTypes.REORGANIZE_FAILED:
        return '重组资源失败，请检查磁盘空间和权限';
      case this.errorTypes.PACK_FAILED:
        return '生成前端包失败，请检查输出路径权限';
      case this.errorTypes.PERMISSION_DENIED:
        return '权限不足，请以管理员身份运行或检查文件权限';
      case this.errorTypes.DISK_FULL:
        return '磁盘空间不足，请清理磁盘后重试';
      case this.errorTypes.NETWORK_ERROR:
        return '网络错误，请检查网络连接后重试';
      case this.errorTypes.UNKNOWN_ERROR:
        return '未知错误，请查看日志获取详细信息';
      default:
        return originalMessage;
    }
  }

  /**
   * 包装异步函数错误处理
   * @param {Function} fn - 异步函数
   * @param {string} context - 错误上下文
   * @returns {Function} 包装后的函数
   */
  asyncWrapper(fn, context = '') {
    return async (...args) => {
      try {
        return await fn(...args);
      } catch (error) {
        return await this.handleError(error, context);
      }
    };
  }

  /**
   * 验证文件路径
   * @param {string} filePath - 文件路径
   * @returns {boolean} 是否有效
   */
  validateFilePath(filePath) {
    if (!filePath || typeof filePath !== 'string') {
      return false;
    }

    const fs = require('fs-extra');
    return fs.existsSync(filePath);
  }

  /**
   * 验证目录权限
   * @param {string} dirPath - 目录路径
   * @returns {boolean} 是否有写入权限
   */
  validateDirectoryPermission(dirPath) {
    try {
      const fs = require('fs-extra');
      const testFile = require('path').join(dirPath, '.test-permission');
      fs.writeFileSync(testFile, 'test');
      fs.unlinkSync(testFile);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 检查磁盘空间
   * @param {string} dirPath - 目录路径
   * @param {number} requiredSize - 需要的空间（字节）
   * @returns {boolean} 是否有足够空间
   */
  checkDiskSpace(dirPath, requiredSize = 1024 * 1024 * 100) { // 默认100MB
    try {
      const fs = require('fs');
      const stats = fs.statfsSync(dirPath);
      const free = stats.bsize * stats.bavail;
      return free >= requiredSize;
    } catch {
      return true;
    }
  }
}

// 导出单例
module.exports = new ErrorHandler();