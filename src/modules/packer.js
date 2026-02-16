const fs = require('fs-extra');
const path = require('path');
const { platform } = require('./index');
const AdmZip = require('adm-zip');

class Packer {
  /**
   * 生成前端包
   * @param {string} sourceDir - 源目录路径
   * @param {string} outputPath - 输出路径
   * @param {string} format - 输出格式：'folder' 或 'zip'
   * @param {object} options - 生成选项
   * @returns {Promise<string>} 输出路径
   */
  async generateFrontendPackage(sourceDir, outputPath, format = 'folder', options = {}) {
    try {
      if (format === 'folder') {
        return await this._generateFolder(sourceDir, outputPath, options);
      } else if (format === 'zip') {
        return await this._generateZip(sourceDir, outputPath, options);
      } else {
        throw new Error(`不支持的输出格式: ${format}`);
      }
    } catch (error) {
      throw new Error(`生成前端包失败: ${error.message}`);
    }
  }

  /**
   * 生成文件夹格式
   * @param {string} sourceDir - 源目录路径
   * @param {string} outputDir - 输出目录路径
   * @param {object} options - 生成选项
   * @returns {Promise<string>} 输出目录路径
   */
  async _generateFolder(sourceDir, outputDir, options = {}) {
    try {
      const { onProgress } = options;
      
      // 确保输出目录不存在
      if (await fs.exists(outputDir)) {
        await fs.remove(outputDir);
      }

      // 使用并行复制提升速度
      if (onProgress) {
        onProgress({ step: 'packing', progress: 85, message: '正在复制文件...' });
      }
      
      // 复制整个目录
      await fs.copy(sourceDir, outputDir);
      
      if (onProgress) {
        onProgress({ step: 'packing', progress: 90, message: '文件夹生成完成' });
      }
      
      return outputDir;
    } catch (error) {
      throw new Error(`生成文件夹失败: ${error.message}`);
    }
  }

  /**
   * 生成ZIP压缩包格式
   * @param {string} sourceDir - 源目录路径
   * @param {string} outputZipPath - 输出ZIP文件路径
   * @param {object} options - 生成选项
   * @returns {Promise<string>} 输出ZIP文件路径
   */
  async _generateZip(sourceDir, outputZipPath, options = {}) {
    try {
      const { onProgress } = options;
      const zip = new AdmZip();
      
      if (onProgress) {
        onProgress({ step: 'packing', progress: 82, message: '正在创建ZIP文件...' });
      }
      
      // 递归添加文件到ZIP
      await this._addDirectoryToZip(zip, sourceDir, '', onProgress);
      
      // 确保输出目录存在
      await fs.ensureDir(path.dirname(outputZipPath));
      
      if (onProgress) {
        onProgress({ step: 'packing', progress: 88, message: '正在写入ZIP文件...' });
      }
      
      // 写入ZIP文件
      zip.writeZip(outputZipPath);
      
      if (onProgress) {
        onProgress({ step: 'packing', progress: 90, message: 'ZIP文件生成完成' });
      }
      
      return outputZipPath;
    } catch (error) {
      throw new Error(`生成ZIP文件失败: ${error.message}`);
    }
  }

  /**
   * 递归添加目录到ZIP
   * @param {AdmZip} zip - AdmZip实例
   * @param {string} directory - 目录路径
   * @param {string} zipPath - ZIP中的路径
   * @param {function} onProgress - 进度回调函数
   */
  async _addDirectoryToZip(zip, directory, zipPath, onProgress) {
    try {
      const entries = await fs.readdir(directory, { withFileTypes: true });

      // 使用并行处理提升速度
      await Promise.all(entries.map(async (entry) => {
        const fullPath = platform.joinPath(directory, entry.name);
        const entryZipPath = platform.joinPath(zipPath, entry.name);

        if (entry.isDirectory()) {
          await this._addDirectoryToZip(zip, fullPath, entryZipPath, onProgress);
        } else if (entry.isFile()) {
          // 使用流式读取大文件
          const content = await fs.readFile(fullPath);
          zip.addFile(entryZipPath, content);
        }
      }));
    } catch (error) {
      console.error(`添加目录到ZIP失败 ${directory}:`, error);
    }
  }

  /**
   * 验证前端包完整性
   * @param {string} packagePath - 前端包路径
   * @returns {Promise<object>} 验证结果
   */
  async validateFrontendPackage(packagePath) {
    try {
      let indexHtmlPath;
      
      if (await fs.stat(packagePath).then(stat => stat.isDirectory())) {
        // 文件夹格式
        indexHtmlPath = platform.joinPath(packagePath, 'index.html');
      } else if (packagePath.slice(packagePath.lastIndexOf('.')).toLowerCase() === '.zip') {
        // ZIP格式
        const zip = new AdmZip(packagePath);
        const zipEntries = zip.getEntries();
        const indexEntry = zipEntries.find(entry => entry.entryName === 'index.html');
        
        if (!indexEntry) {
          throw new Error('ZIP包中缺少index.html文件');
        }
        
        indexHtmlPath = packagePath; // ZIP格式特殊处理
      } else {
        throw new Error(`不支持的前端包格式: ${packagePath.slice(packagePath.lastIndexOf('.'))}`);
      }

      // 检查入口文件
      if (!platform.fileExists(indexHtmlPath) && packagePath.slice(packagePath.lastIndexOf('.')).toLowerCase() !== '.zip') {
        throw new Error('缺少index.html入口文件');
      }

      return {
        success: true,
        message: '前端包验证通过'
      };
    } catch (error) {
      return {
        success: false,
        message: error.message
      };
    }
  }

  /**
   * 获取前端包信息
   * @param {string} packagePath - 前端包路径
   * @returns {Promise<object>} 包信息
   */
  async getPackageInfo(packagePath) {
    try {
      const stats = await fs.stat(packagePath);
      const isDirectory = stats.isDirectory();
      
      let fileCount = 0;
      let size = 0;

      if (isDirectory) {
        // 计算文件夹大小和文件数量
        const { count, totalSize } = await this._calculateDirectoryInfo(packagePath);
        fileCount = count;
        size = totalSize;
      } else if (packagePath.slice(packagePath.lastIndexOf('.')).toLowerCase() === '.zip') {
        // ZIP文件
        const zip = new AdmZip(packagePath);
        const entries = zip.getEntries();
        fileCount = entries.length;
        size = stats.size;
      } else {
        // 其他文件类型
        fileCount = 1;
        size = stats.size;
      }

      return {
        success: true,
        info: {
          path: packagePath,
          isDirectory,
          fileCount,
          size,
          sizeFormatted: this._formatSize(size),
          createdAt: stats.birthtime
        }
      };
    } catch (error) {
      return {
        success: false,
        message: error.message
      };
    }
  }

  /**
   * 计算目录信息
   * @param {string} directory - 目录路径
   * @returns {Promise<object>} 目录信息
   */
  async _calculateDirectoryInfo(directory) {
    let count = 0;
    let totalSize = 0;

    const entries = await fs.readdir(directory, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = platform.joinPath(directory, entry.name);

      if (entry.isDirectory()) {
        const { count: subCount, totalSize: subSize } = await this._calculateDirectoryInfo(fullPath);
        count += subCount;
        totalSize += subSize;
      } else if (entry.isFile()) {
        count++;
        const stats = await fs.stat(fullPath);
        totalSize += stats.size;
      }
    }

    return { count, totalSize };
  }

  /**
   * 格式化文件大小
   * @param {number} bytes - 字节数
   * @returns {string} 格式化后的大小
   */
  _formatSize(bytes) {
    if (bytes === 0) return '0 B';
    
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}

module.exports = Packer;