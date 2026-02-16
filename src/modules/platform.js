const os = require('os');
const path = require('path');
const { shell, app } = require('electron');
const fs = require('fs-extra');
const { execSync } = require('child_process');

class Platform {
  constructor() {
    this.platform = os.platform();
    this.arch = os.arch();
    this.isWindows = this.platform === 'win32';
    this.isMac = this.platform === 'darwin';
    this.isLinux = this.platform === 'linux';
  }

  /**
   * 获取系统类型
   * @returns {string} 系统类型：'windows', 'mac', 'linux'
   */
  getSystemType() {
    if (this.isWindows) return 'windows';
    if (this.isMac) return 'mac';
    if (this.isLinux) return 'linux';
    return 'unknown';
  }

  /**
   * 规范化文件路径
   * @param {string} filePath - 文件路径
   * @returns {string} 规范化后的路径
   */
  normalizePath(filePath) {
    return path.normalize(filePath);
  }

  /**
   * 连接路径
   * @param {...string} paths - 路径片段
   * @returns {string} 连接后的路径
   */
  joinPath(...paths) {
    return path.join(...paths);
  }

  /**
   * 获取路径分隔符
   * @returns {string} 路径分隔符
   */
  getPathSeparator() {
    return path.sep;
  }

  /**
   * 获取用户主目录
   * @returns {string} 用户主目录路径
   */
  getUserHome() {
    return os.homedir();
  }

  /**
   * 获取临时目录
   * @returns {string} 临时目录路径
   */
  getTempDir() {
    return os.tmpdir();
  }

  /**
   * 获取下载目录
   * @returns {string} 下载目录路径
   */
  getDownloadDir() {
    return this.joinPath(this.getUserHome(), 'Downloads');
  }

  /**
   * 打开文件或目录
   * @param {string} path - 文件或目录路径
   * @returns {Promise<boolean>} 是否成功
   */
  async open(path) {
    try {
      await shell.openPath(path);
      return true;
    } catch (error) {
      console.error('打开路径失败:', error);
      return false;
    }
  }

  /**
   * 显示通知
   * @param {object} options - 通知选项
   * @param {string} options.title - 通知标题
   * @param {string} options.body - 通知内容
   */
  showNotification(options) {
    try {
      if (app.isReady()) {
        new (require('electron').Notification)({
          title: options.title,
          body: options.body,
          icon: this.joinPath(__dirname, '../../public/vite.svg')
        }).show();
      }
    } catch (error) {
      console.error('显示通知失败:', error);
    }
  }

  /**
   * 获取系统相关的文件过滤器
   * @returns {array} 文件过滤器数组
   */
  getFileFilters() {
    return [
      { name: '软件包文件', extensions: ['exe', 'dmg', 'deb', 'rpm', 'zip', '7z', 'rar', 'asar'] },
      { name: '压缩文件', extensions: ['zip', '7z', 'rar', 'tar', 'gz'] },
      { name: '所有文件', extensions: ['*'] }
    ];
  }

  /**
   * 检查文件是否存在
   * @param {string} filePath - 文件路径
   * @returns {boolean} 是否存在
   */
  fileExists(filePath) {
    return fs.existsSync(filePath);
  }

  /**
   * 创建目录（递归）
   * @param {string} dirPath - 目录路径
   * @returns {Promise<boolean>} 是否成功
   */
  async createDir(dirPath) {
    try {
      await fs.ensureDir(dirPath);
      return true;
    } catch (error) {
      console.error('创建目录失败:', error);
      return false;
    }
  }

  /**
   * 删除文件或目录
   * @param {string} path - 文件或目录路径
   * @returns {Promise<boolean>} 是否成功
   */
  async remove(path) {
    try {
      await fs.remove(path);
      return true;
    } catch (error) {
      console.error('删除失败:', error);
      return false;
    }
  }

  /**
   * 复制文件或目录
   * @param {string} source - 源路径
   * @param {string} destination - 目标路径
   * @returns {Promise<boolean>} 是否成功
   */
  async copy(source, destination) {
    try {
      await fs.copy(source, destination);
      return true;
    } catch (error) {
      console.error('复制失败:', error);
      return false;
    }
  }

  /**
   * 读取文件
   * @param {string} filePath - 文件路径
   * @param {string} encoding - 编码
   * @returns {Promise<string|Buffer>} 文件内容
   */
  async readFile(filePath, encoding = 'utf8') {
    try {
      return await fs.readFile(filePath, encoding);
    } catch (error) {
      console.error('读取文件失败:', error);
      throw error;
    }
  }

  /**
   * 写入文件
   * @param {string} filePath - 文件路径
   * @param {string|Buffer} content - 文件内容
   * @returns {Promise<boolean>} 是否成功
   */
  async writeFile(filePath, content) {
    try {
      await fs.writeFile(filePath, content);
      return true;
    } catch (error) {
      console.error('写入文件失败:', error);
      return false;
    }
  }

  /**
   * 获取系统信息
   * @returns {object} 系统信息
   */
  getSystemInfo() {
    return {
      platform: this.platform,
      arch: this.arch,
      type: this.getSystemType(),
      release: os.release(),
      version: os.version(),
      memory: {
        total: os.totalmem(),
        free: os.freemem()
      },
      cpu: os.cpus().length
    };
  }

  /**
   * 检查是否为管理员/root权限
   * @returns {boolean} 是否为管理员权限
   */
  isAdmin() {
    try {
      if (this.isWindows) {
        const { execSync } = require('child_process');
        execSync('net session', { stdio: 'ignore' });
        return true;
      } else {
        return process.getuid && process.getuid() === 0;
      }
    } catch {
      return false;
    }
  }

  /**
   * 评估输出路径
   * @param {string} outputPath - 输出路径
   * @returns {object} 路径评估结果
   */
  evaluateOutputPath(outputPath) {
    try {
      const stats = fs.statSync(outputPath);
      const pathInfo = {
        exists: stats.isDirectory(),
        isNetworkDrive: this._isNetworkDrive(outputPath),
        isExternalStorage: this._isExternalStorage(outputPath),
        recommendedPath: this._getRecommendedPath(),
        warnings: []
      };

      // 添加警告
      if (pathInfo.isNetworkDrive) {
        pathInfo.warnings.push('输出路径位于网络驱动器上，可能会导致性能下降');
      }
      
      if (pathInfo.isExternalStorage) {
        pathInfo.warnings.push('输出路径位于外部存储设备上，可能会导致性能下降');
      }

      return pathInfo;
    } catch (error) {
      // 如果路径不存在，检查路径的父目录
      const parentPath = path.dirname(outputPath);
      try {
        const parentStats = fs.statSync(parentPath);
        const pathInfo = {
          exists: false,
          isNetworkDrive: this._isNetworkDrive(parentPath),
          isExternalStorage: this._isExternalStorage(parentPath),
          recommendedPath: this._getRecommendedPath(),
          warnings: []
        };

        // 添加警告
        if (pathInfo.isNetworkDrive) {
          pathInfo.warnings.push('输出路径的父目录位于网络驱动器上，可能会导致性能下降');
        }
        
        if (pathInfo.isExternalStorage) {
          pathInfo.warnings.push('输出路径的父目录位于外部存储设备上，可能会导致性能下降');
        }

        return pathInfo;
      } catch {
        // 如果父目录也不存在，返回基本信息
        return {
          exists: false,
          isNetworkDrive: false,
          isExternalStorage: false,
          recommendedPath: this._getRecommendedPath(),
          warnings: []
        };
      }
    }
  }

  /**
   * 检查路径是否为网络驱动器
   * @param {string} checkPath - 检查路径
   * @returns {boolean} 是否为网络驱动器
   * @private
   */
  _isNetworkDrive(checkPath) {
    try {
      if (this.isWindows) {
        // Windows平台：检查驱动器号是否为网络驱动器
        const driveLetterMatch = checkPath.match(/^([A-Za-z]):/);
        if (driveLetterMatch) {
          const driveLetter = driveLetterMatch[1].toUpperCase();
          const output = execSync(`wmic logicaldisk where "DeviceID='${driveLetter}:'" get DriveType`, { encoding: 'utf8' });
          // 网络驱动器的DriveType为4
          return output.includes('4');
        }
      } else if (this.isMac) {
        // macOS平台：检查路径是否在/Volumes下且不是本地磁盘
        if (checkPath.startsWith('/Volumes/')) {
          const volumeName = checkPath.split('/Volumes/')[1].split('/')[0];
          const output = execSync(`diskutil info /Volumes/${volumeName}`, { encoding: 'utf8' });
          // 检查是否为网络卷
          return output.includes('Network Volume');
        }
      } else if (this.isLinux) {
        // Linux平台：检查路径是否为网络挂载点
        const output = execSync('mount', { encoding: 'utf8' });
        const mountPoints = output.split('\n');
        for (const mountPoint of mountPoints) {
          if (mountPoint.includes('type nfs') || mountPoint.includes('type cifs') || mountPoint.includes('type smbfs')) {
            const mountPath = mountPoint.split(' on ')[1]?.split(' type ')[0];
            if (mountPath && checkPath.startsWith(mountPath)) {
              return true;
            }
          }
        }
      }
      return false;
    } catch (error) {
      console.error('检查网络驱动器失败:', error);
      return false;
    }
  }

  /**
   * 检查路径是否为外部存储设备
   * @param {string} checkPath - 检查路径
   * @returns {boolean} 是否为外部存储设备
   * @private
   */
  _isExternalStorage(checkPath) {
    try {
      if (this.isWindows) {
        // Windows平台：检查驱动器号是否为可移动磁盘
        const driveLetterMatch = checkPath.match(/^([A-Za-z]):/);
        if (driveLetterMatch) {
          const driveLetter = driveLetterMatch[1].toUpperCase();
          const output = execSync(`wmic logicaldisk where "DeviceID='${driveLetter}:'" get DriveType`, { encoding: 'utf8' });
          // 可移动磁盘的DriveType为2
          return output.includes('2');
        }
      } else if (this.isMac) {
        // macOS平台：检查路径是否在/Volumes下且是可移动磁盘
        if (checkPath.startsWith('/Volumes/')) {
          const volumeName = checkPath.split('/Volumes/')[1].split('/')[0];
          const output = execSync(`diskutil info /Volumes/${volumeName}`, { encoding: 'utf8' });
          // 检查是否为可移动磁盘
          return output.includes('Removable Media:') && output.includes('Yes');
        }
      } else if (this.isLinux) {
        // Linux平台：检查路径是否为外部存储设备
        const output = execSync('lsblk -o NAME,TYPE,MOUNTPOINT', { encoding: 'utf8' });
        const lines = output.split('\n');
        for (const line of lines) {
          if (line.includes('part') && line.includes('mountpoint')) {
            const parts = line.split(/\s+/);
            const mountPoint = parts.slice(2).join(' ');
            if (mountPoint && checkPath.startsWith(mountPoint)) {
              // 检查是否为外部设备
              const deviceName = parts[0];
              return deviceName.startsWith('sd') || deviceName.startsWith('usb');
            }
          }
        }
      }
      return false;
    } catch (error) {
      console.error('检查外部存储设备失败:', error);
      return false;
    }
  }

  /**
   * 获取推荐的本地高速存储路径
   * @returns {string} 推荐路径
   * @private
   */
  _getRecommendedPath() {
    const downloadsDir = this.getDownloadDir();
    const frontendExtractDir = path.join(downloadsDir, 'FrontExtract');
    return frontendExtractDir;
  }
}

// 导出单例
module.exports = new Platform();