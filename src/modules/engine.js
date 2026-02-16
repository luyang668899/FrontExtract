/**
 * Engine - 核心解析引擎模块
 * 负责协调各个模块的工作，执行完整的软件包解析流程
 * 包括文件解包、前端资源扫描、资源重组、前端包生成等步骤
 */

const { 
  platform, 
  Unpacker, 
  Decompiler, 
  Packer, 
  logger, 
  performance, 
  resourceMonitor 
} = require('.');
const fs = require('fs-extra');

class Engine {
  /**
   * 构造函数，初始化各个模块实例
   */
  constructor() {
    /**
     * 解包模块实例，负责从各种格式的软件包中提取文件
     * @type {Unpacker}
     */
    this.unpacker = new Unpacker();
    
    /**
     * 反编译模块实例，负责扫描和处理前端文件
     * @type {Decompiler}
     */
    this.decompiler = new Decompiler();
    
    /**
     * 打包模块实例，负责生成前端包
     * @type {Packer}
     */
    this.packer = new Packer();
    
    /**
     * 临时目录路径，用于存放解包和处理过程中的临时文件
     * @type {string}
     */
    this.tempDir = platform.joinPath(platform.getTempDir(), 'fan-temp');
  }

  /**
   * 解析软件包并提取前端资源
   * @param {string} filePath - 软件包路径
   * @param {string} outputDir - 输出目录
   * @param {object} options - 解析选项
   * @param {string} [options.format='folder'] - 输出格式，可选值：'folder' 或 'zip'
   * @param {function} [options.onProgress] - 进度回调函数
   * @param {function} [options.onBackupPrompt] - 备份提示回调函数
   * @returns {Promise<object>} 解析结果
   * @returns {boolean} return.success - 解析是否成功
   * @returns {string} return.message - 解析结果消息
   * @returns {string} return.outputPath - 输出目录路径
   * @returns {string} return.framework - 检测到的前端框架
   * @returns {number} return.fileCount - 提取的文件数量
   * @returns {object} return.packageInfo - 包信息
   */
  async parsePackage(filePath, outputDir, options = {}) {
    const { format = 'folder', onProgress, onBackupPrompt } = options;
    let tempUnpackDir;
    let tempReorganizeDir;

    try {
      logger.info('开始解析软件包', { filePath, outputDir, format });

      // 强制提示用户进行数据备份
      if (onBackupPrompt) {
        const shouldContinue = await onBackupPrompt();
        if (!shouldContinue) {
          throw new Error('用户取消操作');
        }
      }

      // 评估输出路径
      const pathEvaluation = platform.evaluateOutputPath(outputDir);
      if (pathEvaluation.warnings.length > 0) {
        logger.warn('输出路径评估警告', { warnings: pathEvaluation.warnings });
        if (onProgress) {
          for (const warning of pathEvaluation.warnings) {
            onProgress({ 
              step: 'warning', 
              progress: 0, 
              message: `警告: ${warning}` 
            });
          }
          // 显示推荐路径
          onProgress({ 
            step: 'info', 
            progress: 0, 
            message: `推荐使用本地高速存储路径: ${pathEvaluation.recommendedPath}` 
          });
        }
      }

      // 检查文件大小
      const fileStats = await fs.stat(filePath);
      const fileSize = fileStats.size;
      const isLargeFile = fileSize > 100 * 1024 * 1024; // 100MB
      logger.info('文件大小检查', { fileSize, isLargeFile });

      // 检查系统资源是否足够
      const resourceCheck = await resourceMonitor.checkSystemResources(fileSize);
      if (!resourceCheck.hasEnoughResources) {
        logger.warn('系统资源不足', resourceCheck);
        if (onProgress) {
          onProgress({ 
            step: 'error', 
            progress: 0, 
            message: `系统资源不足: ${resourceCheck.alerts.map(a => a.message).join(', ')}` 
          });
        }
        throw new Error(`系统资源不足，无法处理该文件。请关闭其他应用后重试。`);
      }

      // 开始监控资源使用
      resourceMonitor.startMonitoring(2000, (resourceUsage, alerts) => {
        if (alerts.length > 0 && onProgress) {
          onProgress({ 
            step: 'warning', 
            progress: 0, 
            message: `资源使用警报: ${alerts[0].message}` 
          });
        }
      });

      // 1. 初始化临时目录
      await this._initTempDir();
      tempUnpackDir = platform.joinPath(this.tempDir, 'unpacked');
      tempReorganizeDir = platform.joinPath(this.tempDir, 'reorganized');
      logger.debug('初始化临时目录完成', { tempUnpackDir, tempReorganizeDir });

      // 2. 解包文件
      if (onProgress) {
        onProgress({ step: 'unpacking', progress: 10, message: '正在准备解包...' });
      }
      logger.info('开始解包文件', { filePath, tempUnpackDir, isLargeFile });
      await this.unpacker.unpack(filePath, tempUnpackDir, { isLargeFile, onProgress });
      logger.info('解包文件完成');

      // 3. 扫描前端文件
      if (onProgress) {
        onProgress({ step: 'scanning', progress: 40, message: '正在扫描前端文件...' });
      }
      logger.info('开始扫描前端文件', { tempUnpackDir });
      const files = await this.decompiler.scanFrontendFiles(tempUnpackDir);
      const fileCount = Object.values(files).flat().length;
      logger.info('扫描前端文件完成', { fileCount, files: Object.keys(files) });

      // 4. 重组前端资源
      logger.info('开始重组前端资源', { tempUnpackDir, tempReorganizeDir });
      
      // 使用并行处理提升重组速度
      const reorganizeStart = Date.now();
      const reorganizeResult = await this.decompiler.reorganizeResources(tempUnpackDir, tempReorganizeDir, { onProgress });
      const reorganizeEnd = Date.now();
      
      logger.info('重组前端资源完成', {
        framework: reorganizeResult.framework, 
        files: reorganizeResult.files,
        duration: `${reorganizeEnd - reorganizeStart}ms`
      });

      // 5. 生成前端包
      logger.info('开始生成前端包', { tempReorganizeDir, outputDir, format });
      const outputPath = await this.packer.generateFrontendPackage(tempReorganizeDir, outputDir, format, { onProgress });
      logger.info('生成前端包完成', { outputPath });

      // 6. 验证前端包
      if (onProgress) {
        onProgress({ step: 'validating', progress: 95, message: '正在验证前端包...' });
      }
      logger.info('开始验证前端包', { outputPath });
      const validateResult = await this.packer.validateFrontendPackage(outputPath);
      
      if (!validateResult.success) {
        throw new Error(`前端包验证失败: ${validateResult.message}`);
      }
      logger.info('验证前端包完成');

      // 7. 获取包信息
      logger.info('开始获取包信息', { outputPath });
      const packageInfo = await this.packer.getPackageInfo(outputPath);
      logger.info('获取包信息完成', { packageInfo: packageInfo.info });

      if (onProgress) {
        onProgress({ step: 'completed', progress: 100, message: '解析完成' });
      }

      const result = {
        success: true,
        message: '前端资源提取成功',
        outputPath,
        framework: reorganizeResult.framework,
        fileCount: reorganizeResult.files,
        packageInfo: packageInfo.info
      };
      
      logger.info('解析软件包完成', result);
      return result;
    } catch (error) {
      logger.error('解析软件包失败', { error: error.message, stack: error.stack });
      if (onProgress) {
        onProgress({ step: 'error', progress: 0, message: `错误: ${error.message}` });
      }
      throw error;
    } finally {
      // 停止资源监控
      resourceMonitor.stopMonitoring();
      
      // 清理内存缓存
      performance.clearMemoryCache();
      
      // 清理临时文件
      logger.debug('开始清理临时文件', { tempDir: this.tempDir });
      await this._cleanupTempDir();
      logger.debug('清理临时文件完成');
    }
  }

  /**
   * 初始化临时目录
   * @private
   * @returns {Promise<void>}
   */
  async _initTempDir() {
    // 清理旧的临时目录
    await this._cleanupTempDir();
    // 创建新的临时目录
    await platform.createDir(this.tempDir);
    // 注册临时目录
    performance.tempFileManager.registerTempFile(this.tempDir);
  }

  /**
   * 清理临时目录
   * @private
   * @returns {Promise<void>}
   */
  async _cleanupTempDir() {
    try {
      if (platform.fileExists(this.tempDir)) {
        await platform.remove(this.tempDir);
      }
    } catch (error) {
      logger.error('清理临时目录失败', { error: error.message });
    }
  }

  /**
   * 获取支持的文件格式
   * @returns {object} 支持的文件格式
   * @returns {array} return.zip - 支持的ZIP格式文件扩展名
   * @returns {array} return.electron - 支持的Electron格式文件扩展名
   * @returns {array} return.other - 支持的其他格式文件扩展名
   */
  getSupportedFormats() {
    return this.unpacker.supportedFormats;
  }

  /**
   * 检查文件是否支持
   * @param {string} filePath - 文件路径
   * @returns {boolean} 是否支持
   */
  isSupported(filePath) {
    const format = this.unpacker.detectFormat(filePath);
    return format !== 'unknown';
  }
}

module.exports = Engine;