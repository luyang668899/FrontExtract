const path = require('path');
const platform = require('./platform');
const performance = require('./performance');
const AdmZip = require('adm-zip');
const extractZip = require('extract-zip');
const { execSync } = require('child_process');
const fs = require('fs-extra');

class Unpacker {
  constructor() {
    this.supportedFormats = {
      zip: ['.zip', '.asar'],
      electron: ['.exe', '.dmg', '.deb', '.rpm'],
      other: ['.7z', '.rar']
    };
  }

  /**
   * 检测文件格式
   * @param {string} filePath - 文件路径
   * @returns {string} 格式类型
   */
  detectFormat(filePath) {
    const ext = filePath.slice(filePath.lastIndexOf('.')).toLowerCase();
    
    for (const [format, extensions] of Object.entries(this.supportedFormats)) {
      if (extensions.includes(ext)) {
        return format;
      }
    }
    
    return 'unknown';
  }

  /**
   * 解包文件
   * @param {string} filePath - 文件路径
   * @param {string} outputDir - 输出目录
   * @param {object} options - 解包选项
   * @returns {Promise<string>} 解包后的目录路径
   */
  async unpack(filePath, outputDir, options = {}) {
    const { isLargeFile = false, onProgress } = options;
    const format = this.detectFormat(filePath);
    
    switch (format) {
      case 'zip':
        return await this.unpackZip(filePath, outputDir, { isLargeFile, onProgress });
      case 'electron':
        return await this.unpackElectron(filePath, outputDir, { isLargeFile, onProgress });
      default:
        throw new Error(`不支持的文件格式: ${path.extname(filePath)}`);
    }
  }

  /**
   * 解包ZIP格式文件
   * @param {string} filePath - 文件路径
   * @param {string} outputDir - 输出目录
   * @param {object} options - 解包选项
   * @returns {Promise<string>} 解包后的目录路径
   */
  async unpackZip(filePath, outputDir, options = {}) {
    try {
      const { isLargeFile = false, onProgress } = options;
      
      if (path.extname(filePath).toLowerCase() === '.asar') {
        // ASAR格式特殊处理
        return await this.unpackAsar(filePath, outputDir, { isLargeFile, onProgress });
      }
      
      const zip = new AdmZip(filePath);
      
      if (isLargeFile && onProgress) {
        // 大型文件处理：显示详细进度并分批处理
        const entries = zip.getEntries();
        const totalEntries = entries.length;
        let processedEntries = 0;
        
        // 分批处理条目，每批处理10个文件
        const batchSize = 10;
        for (let i = 0; i < entries.length; i += batchSize) {
          const batch = entries.slice(i, i + batchSize);
          
          for (const entry of batch) {
            if (!entry.isDirectory) {
              zip.extractEntryTo(entry, outputDir, true, true);
              processedEntries++;
              const progress = Math.round((processedEntries / totalEntries) * 30) + 10; // 10-40%
              onProgress({ 
                step: 'unpacking', 
                progress, 
                message: `正在解包文件: ${entry.entryName} (${processedEntries}/${totalEntries})` 
              });
            }
          }
          
          // 每批处理完成后，给事件循环一个机会处理其他任务
          await new Promise(resolve => setTimeout(resolve, 10));
        }
      } else {
        // 普通文件处理
        zip.extractAllTo(outputDir, true);
      }
      
      return outputDir;
    } catch (error) {
      throw new Error(`解包ZIP文件失败: ${error.message}`);
    }
  }

  /**
   * 解包ASAR格式文件
   * @param {string} filePath - 文件路径
   * @param {string} outputDir - 输出目录
   * @param {object} options - 解包选项
   * @returns {Promise<string>} 解包后的目录路径
   */
  async unpackAsar(filePath, outputDir, options = {}) {
    try {
      const { onProgress } = options;
      
      if (onProgress) {
        onProgress({ step: 'unpacking', progress: 25, message: '正在解包ASAR文件...' });
      }
      
      // 使用extract-zip解包ASAR
      await extractZip(filePath, { dir: outputDir });
      
      if (onProgress) {
        onProgress({ step: 'unpacking', progress: 40, message: 'ASAR文件解包完成' });
      }
      
      return outputDir;
    } catch (error) {
      throw new Error(`解包ASAR文件失败: ${error.message}`);
    }
  }

  /**
   * 解包Electron格式文件
   * @param {string} filePath - 文件路径
   * @param {string} outputDir - 输出目录
   * @param {object} options - 解包选项
   * @returns {Promise<string>} 解包后的目录路径
   */
  async unpackElectron(filePath, outputDir, options = {}) {
    try {
      const { onProgress } = options;
      const ext = path.extname(filePath).toLowerCase();
      
      switch (ext) {
        case '.exe':
          // Windows Electron 应用
          if (onProgress) {
            onProgress({ step: 'unpacking', progress: 15, message: '正在解包Windows应用...' });
          }
          return await this.unpackWindowsExe(filePath, outputDir);
        case '.dmg':
          // macOS Electron 应用
          if (onProgress) {
            onProgress({ step: 'unpacking', progress: 15, message: '正在解包macOS应用...' });
          }
          return await this.unpackDmg(filePath, outputDir);
        case '.deb':
        case '.rpm':
          // Linux 包
          if (onProgress) {
            onProgress({ step: 'unpacking', progress: 15, message: '正在解包Linux应用...' });
          }
          return await this.unpackLinuxPackage(filePath, outputDir);
        default:
          throw new Error(`不支持的Electron包格式: ${ext}`);
      }
    } catch (error) {
      throw new Error(`解包Electron文件失败: ${error.message}`);
    }
  }

  /**
   * 解包Windows EXE文件
   * @param {string} filePath - 文件路径
   * @param {string} outputDir - 输出目录
   * @returns {Promise<string>} 解包后的目录路径
   */
  async unpackWindowsExe(filePath, outputDir) {
    try {
      // Windows EXE 通常是NSIS或Squirrel安装包
      // 这里简化处理，尝试作为ZIP解包
      const zip = new AdmZip(filePath);
      zip.extractAllTo(outputDir, true);
      return outputDir;
    } catch (error) {
      throw new Error(`解包Windows EXE失败: ${error.message}`);
    }
  }

  /**
   * 解包macOS DMG文件
   * @param {string} filePath - 文件路径
   * @param {string} outputDir - 输出目录
   * @returns {Promise<string>} 解包后的目录路径
   */
  async unpackDmg(filePath, outputDir) {
    try {
      
      // 确保输出目录存在
      await fs.ensureDir(outputDir);
      
      if (platform.isMac) {
        // 在macOS上使用hdiutil命令
        const mountPoint = path.join(platform.getTempDir(), `dmg-mount-${Date.now()}`);
        await fs.ensureDir(mountPoint);
        
        // 注册临时挂载点
        if (performance && performance.tempFileManager) {
          performance.tempFileManager.registerTempFile(mountPoint);
        }
        
        try {
          // 挂载DMG文件
          execSync(`hdiutil attach "${filePath}" -mountpoint "${mountPoint}" -nobrowse`, { stdio: 'ignore' });
          
          // 复制挂载点内容到输出目录
          const mountContents = await fs.readdir(mountPoint);
          for (const item of mountContents) {
            const itemPath = path.join(mountPoint, item);
            const destPath = path.join(outputDir, item);
            
            if ((await fs.stat(itemPath)).isDirectory()) {
              await fs.copy(itemPath, destPath, { recursive: true });
            } else {
              await fs.copy(itemPath, destPath);
            }
          }
        } finally {
          // 卸载DMG文件
          try {
            execSync(`hdiutil detach "${mountPoint}"`, { stdio: 'ignore' });
          } catch {
            // 忽略卸载错误
          }
          // 清理挂载点
          try {
            await fs.remove(mountPoint);
          } catch (error) {
            console.error('清理挂载点失败:', error);
          }
        }
      } else {
        // 在非macOS平台上，尝试使用7z或其他工具
        // 这里提供一个基于文件格式分析的解决方案
        throw new Error('DMG文件解包仅在macOS平台上支持');
      }
      
      return outputDir;
    } catch (error) {
      throw new Error(`解包DMG文件失败: ${error.message}`);
    }
  }

  /**
   * 解包Linux包文件
   * @param {string} filePath - 文件路径
   * @param {string} outputDir - 输出目录
   * @returns {Promise<string>} 解包后的目录路径
   */
  async unpackLinuxPackage(filePath, outputDir) {
    try {
      const ext = path.extname(filePath).toLowerCase();
      
      // 确保输出目录存在
      await fs.ensureDir(outputDir);
      
      switch (ext) {
        case '.deb':
          // 解包DEB文件
          if (platform.isLinux || platform.isMac) {
            // 使用ar命令提取DEB包
            execSync(`ar x "${filePath}"`, { cwd: outputDir, stdio: 'ignore' });
            
            // 提取data.tar.gz或data.tar.xz
            const debContents = await fs.readdir(outputDir);
            const dataTar = debContents.find(file => file.startsWith('data.tar.'));
            
            if (dataTar) {
              if (dataTar.endsWith('.gz')) {
                execSync(`tar -xzf "${dataTar}"`, { cwd: outputDir, stdio: 'ignore' });
              } else if (dataTar.endsWith('.xz')) {
                execSync(`tar -xJf "${dataTar}"`, { cwd: outputDir, stdio: 'ignore' });
              }
              
              // 清理临时文件
              for (const file of debContents) {
                await fs.remove(path.join(outputDir, file));
              }
            }
          } else {
            throw new Error('DEB文件解包在当前平台上不支持');
          }
          break;
          
        case '.rpm':
          // 解包RPM文件
          if (platform.isLinux || platform.isMac) {
            // 使用rpm2cpio和cpio命令提取RPM包
            execSync(`rpm2cpio "${filePath}" | cpio -idmv`, { cwd: outputDir, stdio: 'ignore' });
          } else {
            throw new Error('RPM文件解包在当前平台上不支持');
          }
          break;
          
        default:
          throw new Error(`不支持的Linux包格式: ${ext}`);
      }
      
      return outputDir;
    } catch (error) {
      throw new Error(`解包Linux包失败: ${error.message}`);
    }
  }

  /**
   * 清理临时文件
   * @param {string} tempDir - 临时目录
   */
  async cleanup(tempDir) {
    try {
      if (platform.fileExists(tempDir)) {
        await platform.remove(tempDir);
      }
    } catch (error) {
      console.error('清理临时文件失败:', error);
    }
  }
}

module.exports = Unpacker;