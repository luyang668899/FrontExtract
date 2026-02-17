const os = require('os');
const logger = require('./logger');
const fs = require('fs-extra');
const path = require('path');
const { execSync } = require('child_process');
const platform = require('./platform');

class ResourceMonitor {
  constructor() {
    this.monitoring = false;
    this.monitoringInterval = null;
    this.resourceThresholds = {
      memory: 80, // 内存使用阈值（百分比）
      cpu: 80,    // CPU使用阈值（百分比）
      disk: 90    // 磁盘使用阈值（百分比）
    };
  }

  /**
   * 开始监控资源使用情况
   * @param {number} interval - 监控间隔（毫秒）
   * @param {function} callback - 监控回调函数
   */
  startMonitoring(interval = 1000, callback = null) {
    if (this.monitoring) {
      return;
    }

    this.monitoring = true;
    logger.info('开始监控系统资源使用情况');

    this.monitoringInterval = setInterval(async () => {
      const resourceUsage = await this.getResourceUsage();
      const alerts = this.checkResourceThresholds(resourceUsage);

      if (callback) {
        callback(resourceUsage, alerts);
      }

      // 记录资源使用情况
      logger.debug('系统资源使用情况', resourceUsage);

      // 发送警报
      if (alerts.length > 0) {
        logger.warn('资源使用警报', alerts);
      }
    }, interval);
  }

  /**
   * 停止监控资源使用情况
   */
  stopMonitoring() {
    if (!this.monitoring) {
      return;
    }

    clearInterval(this.monitoringInterval);
    this.monitoring = false;
    logger.info('停止监控系统资源使用情况');
  }

  /**
   * 获取当前资源使用情况
   * @returns {object} 资源使用情况
   */
  async getResourceUsage() {
    // 获取内存使用情况
    const memory = {
      total: os.totalmem(),
      free: os.freemem(),
      used: os.totalmem() - os.freemem(),
      usage: Math.round(((os.totalmem() - os.freemem()) / os.totalmem()) * 100)
    };

    // 获取CPU使用情况
    const cpus = os.cpus();
    const cpuCount = cpus.length;
    const cpuUsage = this.getCpuUsage();

    // 获取磁盘使用情况
    const diskUsage = await this.getDiskUsage();

    return {
      memory,
      cpu: {
        count: cpuCount,
        usage: cpuUsage
      },
      disk: diskUsage,
      uptime: os.uptime(),
      loadavg: os.loadavg()
    };
  }

  /**
   * 获取CPU使用情况
   * @returns {number} CPU使用率（百分比）
   */
  getCpuUsage() {
    // 简化版CPU使用率计算
    // 注意：此方法只能获取一个近似值
    const loadAvg = os.loadavg()[0];
    const cpuCount = os.cpus().length;
    return Math.round((loadAvg / cpuCount) * 100);
  }

  /**
   * 获取磁盘使用情况
   * @returns {Promise<object>} 磁盘使用情况
   */
  async getDiskUsage() {
    try {
      const stats = await fs.statfs(path.dirname(require.main.filename));
      const total = stats.bsize * stats.blocks;
      const free = stats.bsize * stats.bavail;
      const used = total - free;

      return {
        total,
        free,
        used,
        usage: Math.round((used / total) * 100)
      };
    } catch (error) {
      logger.error('获取磁盘使用情况失败', error);
      return {
        total: 0,
        free: 0,
        used: 0,
        usage: 0
      };
    }
  }

  /**
   * 检查资源使用是否超过阈值
   * @param {object} resourceUsage - 资源使用情况
   * @returns {array} 警报列表
   */
  checkResourceThresholds(resourceUsage) {
    const alerts = [];

    // 检查内存使用
    if (resourceUsage.memory.usage > this.resourceThresholds.memory) {
      alerts.push({
        type: 'memory',
        message: `内存使用过高: ${resourceUsage.memory.usage}%`,
        value: resourceUsage.memory.usage,
        threshold: this.resourceThresholds.memory
      });
    }

    // 检查CPU使用
    if (resourceUsage.cpu.usage > this.resourceThresholds.cpu) {
      alerts.push({
        type: 'cpu',
        message: `CPU使用过高: ${resourceUsage.cpu.usage}%`,
        value: resourceUsage.cpu.usage,
        threshold: this.resourceThresholds.cpu
      });
    }

    // 检查磁盘使用
    if (resourceUsage.disk.usage > this.resourceThresholds.disk) {
      alerts.push({
        type: 'disk',
        message: `磁盘使用过高: ${resourceUsage.disk.usage}%`,
        value: resourceUsage.disk.usage,
        threshold: this.resourceThresholds.disk
      });
    }

    return alerts;
  }

  /**
   * 设置资源使用阈值
   * @param {object} thresholds - 阈值设置
   */
  setThresholds(thresholds) {
    this.resourceThresholds = {
      ...this.resourceThresholds,
      ...thresholds
    };
    logger.info('更新资源使用阈值', this.resourceThresholds);
  }

  /**
   * 获取资源使用阈值
   * @returns {object} 阈值设置
   */
  getThresholds() {
    return this.resourceThresholds;
  }

  /**
   * 检查系统是否有足够资源处理大型文件
   * @param {number} fileSize - 文件大小（字节）
   * @returns {object} 检查结果
   */
  async checkSystemResources(fileSize) {
    const resourceUsage = await this.getResourceUsage();
    const alerts = this.checkResourceThresholds(resourceUsage);

    // 检查是否有足够内存处理文件
    const requiredMemory = fileSize * 2; // 假设需要两倍文件大小的内存
    const availableMemory = resourceUsage.memory.free;
    const hasEnoughMemory = availableMemory > requiredMemory;

    // 即使有警告，只要有足够的实际可用内存，就允许操作继续
    return {
      hasEnoughResources: hasEnoughMemory,
      resourceUsage,
      alerts,
      memoryCheck: {
        required: requiredMemory,
        available: availableMemory,
        sufficient: hasEnoughMemory
      }
    };
  }

  /**
   * 格式化字节大小
   * @param {number} bytes - 字节数
   * @returns {string} 格式化后的大小
   */
  formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * 检测后台应用程序
   * @returns {Promise<array>} 后台应用程序列表
   */
  async detectBackgroundApplications() {
    try {
      switch (platform) {
        case 'darwin': // macOS
          return this.detectMacOSApplications();
        case 'win32': // Windows
          return this.detectWindowsApplications();
        case 'linux': // Linux
          return this.detectLinuxApplications();
        default:
          logger.warn('不支持的平台:', platform);
          return [];
      }
    } catch (error) {
      logger.error('检测后台应用程序失败:', error);
      return [];
    }
  }

  /**
   * 检测macOS应用程序
   * @returns {array} 应用程序列表
   */
  detectMacOSApplications() {
    try {
      const output = execSync('ps aux | grep -E "\.app/Contents/MacOS/" | grep -v grep', { encoding: 'utf8' });
      const lines = output.trim().split('\n');
      const applications = [];

      for (const line of lines) {
        if (line.trim()) {
          const parts = line.split(/\s+/);
          const pid = parts[1];
          const cpu = parseFloat(parts[2]);
          const mem = parseFloat(parts[3]);
          const command = parts.slice(10).join(' ');
          const appNameMatch = command.match(/\/([^/]+)\.app\//);
          const appName = appNameMatch ? appNameMatch[1] : 'Unknown';

          applications.push({
            pid,
            name: appName,
            cpu,
            mem,
            command
          });
        }
      }

      return applications;
    } catch (error) {
      logger.error('检测macOS应用程序失败:', error);
      return [];
    }
  }

  /**
   * 检测Windows应用程序
   * @returns {array} 应用程序列表
   */
  detectWindowsApplications() {
    try {
      const output = execSync('tasklist /fo csv /nh', { encoding: 'utf8' });
      const lines = output.trim().split('\n');
      const applications = [];

      for (const line of lines) {
        if (line.trim()) {
          const parts = line.split('"').filter(Boolean);
          if (parts.length >= 5) {
            const name = parts[0];
            const pid = parts[1];
            const mem = parseFloat(parts[4].replace(/,/g, '')) / 1024; // 转换为MB

            applications.push({
              pid,
              name,
              cpu: 0, // Windows tasklist 不直接提供CPU使用率
              mem,
              command: name
            });
          }
        }
      }

      return applications;
    } catch (error) {
      logger.error('检测Windows应用程序失败:', error);
      return [];
    }
  }

  /**
   * 检测Linux应用程序
   * @returns {array} 应用程序列表
   */
  detectLinuxApplications() {
    try {
      const output = execSync('ps aux | grep -v "\[\]" | grep -v grep', { encoding: 'utf8' });
      const lines = output.trim().split('\n');
      const applications = [];

      for (const line of lines) {
        if (line.trim()) {
          const parts = line.split(/\s+/);
          const pid = parts[1];
          const cpu = parseFloat(parts[2]);
          const mem = parseFloat(parts[3]);
          const command = parts.slice(10).join(' ');
          const name = command.split(/\s+/)[0].split('/').pop();

          applications.push({
            pid,
            name,
            cpu,
            mem,
            command
          });
        }
      }

      return applications;
    } catch (error) {
      logger.error('检测Linux应用程序失败:', error);
      return [];
    }
  }

  /**
   * 识别非核心后台应用程序
   * @param {array} applications - 应用程序列表
   * @returns {array} 非核心应用程序列表
   */
  identifyNonCoreApplications(applications) {
    // 核心应用程序列表（根据实际情况调整）
    const coreApplications = [
      'Finder', 'SystemUIServer', ' Dock', 'loginwindow', // macOS核心
      'explorer.exe', 'svchost.exe', 'services.exe', 'lsass.exe', // Windows核心
      'systemd', 'Xorg', 'gnome-shell', 'kwin_x11' // Linux核心
    ];

    // 资源使用阈值
    const resourceThresholds = {
      cpu: 5,  // CPU使用率超过5%
      mem: 100 // 内存使用超过100MB
    };

    return applications.filter(app => {
      // 排除核心应用程序
      const isCoreApp = coreApplications.some(coreApp => 
        app.name.toLowerCase().includes(coreApp.toLowerCase())
      );

      // 排除当前应用程序
      const isCurrentApp = app.command.includes('electron') || 
                          app.command.includes('FrontExtract');

      // 检查资源使用
      const isResourceIntensive = app.cpu > resourceThresholds.cpu || 
                                 app.mem > resourceThresholds.mem;

      return !isCoreApp && !isCurrentApp && isResourceIntensive;
    });
  }

  /**
   * 检测并提示关闭非核心应用程序
   * @returns {Promise<object>} 检测结果
   */
  async detectAndSuggestClosingApplications() {
    const allApplications = await this.detectBackgroundApplications();
    const nonCoreApplications = this.identifyNonCoreApplications(allApplications);

    // 按资源使用量排序
    nonCoreApplications.sort((a, b) => {
      return (b.cpu + b.mem) - (a.cpu + a.mem);
    });

    // 只返回前5个最消耗资源的应用程序
    const topResourceIntensiveApps = nonCoreApplications.slice(0, 5);

    logger.info('检测到的非核心应用程序数量:', nonCoreApplications.length);
    if (topResourceIntensiveApps.length > 0) {
      logger.info('建议关闭的应用程序:', topResourceIntensiveApps.map(app => app.name));
    }

    return {
      totalApplications: allApplications.length,
      nonCoreApplications: nonCoreApplications.length,
      suggestedApplications: topResourceIntensiveApps
    };
  }
}


// 导出单例
module.exports = new ResourceMonitor;