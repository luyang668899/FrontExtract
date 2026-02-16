const fs = require('fs-extra');
const path = require('path');
const os = require('os');

class Logger {
  constructor() {
    this.logDir = path.join(os.homedir(), '.fan', 'logs');
    this.logFile = path.join(this.logDir, `${new Date().toISOString().split('T')[0]}.log`);
    this._initLogDir();
  }

  /**
   * 初始化日志目录
   */
  async _initLogDir() {
    try {
      await fs.ensureDir(this.logDir);
    } catch (error) {
      console.error('初始化日志目录失败:', error);
    }
  }

  /**
   * 记录日志
   * @param {string} level - 日志级别: info, warn, error, debug
   * @param {string} message - 日志消息
   * @param {object} data - 附加数据
   */
  async log(level, message, data = {}) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      message,
      data
    };

    const logString = JSON.stringify(logEntry) + '\n';

    // 输出到控制台
    this._consoleLog(level, message, data);

    // 写入日志文件
    try {
      await fs.appendFile(this.logFile, logString);
    } catch (error) {
      console.error('写入日志文件失败:', error);
    }
  }

  /**
   * 控制台输出
   * @param {string} level - 日志级别
   * @param {string} message - 日志消息
   * @param {object} data - 附加数据
   */
  _consoleLog(level, message, data) {
    const timestamp = new Date().toLocaleString();
    const prefix = `[${timestamp}] [${level.toUpperCase()}]`;

    switch (level) {
      case 'info':
        console.log(`${prefix} ${message}`, data);
        break;
      case 'warn':
        console.warn(`${prefix} ${message}`, data);
        break;
      case 'error':
        console.error(`${prefix} ${message}`, data);
        break;
      case 'debug':
        if (process.env.NODE_ENV === 'development') {
          console.debug(`${prefix} ${message}`, data);
        }
        break;
      default:
        console.log(`${prefix} ${message}`, data);
    }
  }

  /**
   * 记录信息日志
   * @param {string} message - 日志消息
   * @param {object} data - 附加数据
   */
  async info(message, data = {}) {
    await this.log('info', message, data);
  }

  /**
   * 记录警告日志
   * @param {string} message - 日志消息
   * @param {object} data - 附加数据
   */
  async warn(message, data = {}) {
    await this.log('warn', message, data);
  }

  /**
   * 记录错误日志
   * @param {string} message - 日志消息
   * @param {object} data - 附加数据
   */
  async error(message, data = {}) {
    await this.log('error', message, data);
  }

  /**
   * 记录调试日志
   * @param {string} message - 日志消息
   * @param {object} data - 附加数据
   */
  async debug(message, data = {}) {
    await this.log('debug', message, data);
  }

  /**
   * 捕获全局错误
   */
  captureGlobalErrors() {
    // 捕获未处理的Promise拒绝
    process.on('unhandledRejection', async (reason) => {
      await this.error('未处理的Promise拒绝', {
        reason: reason.message || reason,
        stack: reason.stack
      });
    });

    // 捕获未捕获的异常
    process.on('uncaughtException', async (error) => {
      await this.error('未捕获的异常', {
        message: error.message,
        stack: error.stack
      });
    });
  }

  /**
   * 获取日志文件路径
   * @returns {string} 日志文件路径
   */
  getLogFilePath() {
    return this.logFile;
  }

  /**
   * 清理旧日志
   * @param {number} days - 保留天数
   */
  async cleanOldLogs(days = 7) {
    try {
      const now = new Date();
      const cutoffDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

      const files = await fs.readdir(this.logDir);
      for (const file of files) {
        const filePath = path.join(this.logDir, file);
        const stats = await fs.stat(filePath);
        
        if (stats.isFile() && stats.mtime < cutoffDate) {
          await fs.unlink(filePath);
        }
      }
    } catch (error) {
      console.error('清理旧日志失败:', error);
    }
  }
}

// 导出单例
const logger = new Logger();
module.exports = logger;