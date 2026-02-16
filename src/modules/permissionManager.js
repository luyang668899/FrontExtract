const fs = require('fs-extra');
const path = require('path');
const platform = require('./platform');
const logger = require('./logger');

class PermissionManager {
  constructor() {
    this.platform = process.platform;
    this.permissionLevels = {
      minimal: {
        description: '最小权限级别',
        requiredPermissions: ['read'],
        allowedActions: ['scan', 'analyze', 'extract']
      },
      standard: {
        description: '标准权限级别',
        requiredPermissions: ['read', 'write'],
        allowedActions: ['scan', 'analyze', 'extract', 'save', 'modify']
      },
      advanced: {
        description: '高级权限级别',
        requiredPermissions: ['read', 'write', 'execute'],
        allowedActions: ['scan', 'analyze', 'extract', 'save', 'modify', 'execute']
      }
    };
  }

  /**
   * 检测文件/目录权限
   * @param {string} targetPath - 目标文件或目录路径
   * @returns {Promise<object>} 权限检测结果
   */
  async detectPermissions(targetPath) {
    try {
      // 检查路径是否存在
      const exists = await fs.pathExists(targetPath);
      
      if (!exists) {
        return {
          success: false,
          error: '路径不存在',
          path: targetPath,
          exists: false
        };
      }

      // 获取文件/目录状态
      const stats = await fs.stat(targetPath);
      const isDirectory = stats.isDirectory();

      // 检查读写权限
      let canRead = false;
      let canWrite = false;
      let canExecute = false;

      try {
        // 检查读取权限
        if (isDirectory) {
          await fs.readdir(targetPath);
        } else {
          await fs.readFile(targetPath, 'utf8');
        }
        canRead = true;
      } catch {
        canRead = false;
      }

      try {
        // 检查写入权限
        if (isDirectory) {
          const testFile = path.join(targetPath, '.test-write-permission');
          await fs.writeFile(testFile, 'test');
          await fs.unlink(testFile);
        } else {
          // 对于文件，创建一个临时副本测试写入权限
          const testFile = `${targetPath}.test`;
          await fs.writeFile(testFile, 'test');
          await fs.unlink(testFile);
        }
        canWrite = true;
      } catch {
        canWrite = false;
      }

      try {
        // 检查执行权限（仅适用于文件）
        if (!isDirectory) {
          await fs.access(targetPath, fs.constants.X_OK);
          canExecute = true;
        }
      } catch {
        canExecute = false;
      }

      return {
        success: true,
        path: targetPath,
        exists: true,
        isDirectory,
        permissions: {
          read: canRead,
          write: canWrite,
          execute: canExecute
        },
        platform: this.platform
      };
    } catch (error) {
      logger.error('权限检测失败', { targetPath, error });
      return {
        success: false,
        error: error.message,
        path: targetPath
      };
    }
  }

  /**
   * 检测磁盘状态
   * @param {string} dirPath - 目录路径
   * @returns {Promise<object>} 磁盘状态检测结果
   */
  async detectDiskStatus(dirPath) {
    try {
      const stats = fs.statfsSync(dirPath);
      const free = stats.bsize * stats.bavail;
      const total = stats.bsize * stats.blocks;
      const used = total - free;

      // 检查磁盘是否只读
      let isReadOnly = false;
      try {
        const testFile = path.join(dirPath, '.test-disk-write');
        await fs.writeFile(testFile, 'test');
        await fs.unlink(testFile);
      } catch {
        isReadOnly = true;
      }

      return {
        success: true,
        path: dirPath,
        total: total,
        free: free,
        used: used,
        usedPercentage: (used / total) * 100,
        isReadOnly: isReadOnly
      };
    } catch (error) {
      logger.error('磁盘状态检测失败', { dirPath, error });
      return {
        success: false,
        error: error.message,
        path: dirPath
      };
    }
  }

  /**
   * 获取权限问题解决方案
   * @param {object} permissionResult - 权限检测结果
   * @returns {object} 解决方案
   */
  getPermissionSolution(permissionResult) {
    if (!permissionResult.success) {
      if (permissionResult.error === '路径不存在') {
        return {
          type: 'path_not_exists',
          message: '路径不存在，请选择或创建一个有效的路径',
          steps: [
            '检查路径是否输入正确',
            '确保父目录存在',
            '尝试创建不存在的目录'
          ],
          recommendedAction: 'create_path'
        };
      }
      return {
        type: 'unknown_error',
        message: `权限检测失败：${permissionResult.error}`,
        steps: [
          '检查路径是否正确',
          '确保路径存在',
          '尝试选择其他路径'
        ],
        recommendedAction: 'select_other_path'
      };
    }

    if (!permissionResult.permissions.write) {
      return {
        type: 'write_permission_denied',
        message: '没有写入权限，请检查权限设置或选择其他路径',
        steps: this._getWritePermissionSteps(),
        recommendedAction: 'request_permission'
      };
    }

    if (!permissionResult.permissions.read) {
      return {
        type: 'read_permission_denied',
        message: '没有读取权限，请检查权限设置或选择其他路径',
        steps: this._getReadPermissionSteps(),
        recommendedAction: 'request_permission'
      };
    }

    return {
      type: 'permission_granted',
      message: '权限正常',
      steps: [],
      recommendedAction: 'proceed'
    };
  }

  /**
   * 获取写入权限解决方案步骤
   * @returns {array} 解决方案步骤
   */
  _getWritePermissionSteps() {
    switch (this.platform) {
      case 'win32':
        return [
          '右键点击应用程序',
          '选择"以管理员身份运行"',
          '或修改目标文件夹的权限设置'
        ];
      case 'darwin':
        return [
          '在终端中使用 sudo 命令运行应用',
          '或在系统偏好设置中修改文件夹权限',
          '或选择用户主目录下的文件夹'
        ];
      case 'linux':
        return [
          '使用 sudo 命令运行应用',
          '或使用 chmod 命令修改文件夹权限',
          '或选择用户主目录下的文件夹'
        ];
      default:
        return [
          '检查目标文件夹的权限设置',
          '确保当前用户有写入权限',
          '尝试选择其他路径'
        ];
    }
  }

  /**
   * 获取读取权限解决方案步骤
   * @returns {array} 解决方案步骤
   */
  _getReadPermissionSteps() {
    switch (this.platform) {
      case 'win32':
        return [
          '右键点击文件/文件夹',
          '选择"属性" -> "安全"',
          '添加当前用户的读取权限'
        ];
      case 'darwin':
        return [
          '右键点击文件/文件夹',
          '选择"显示简介"',
          '在"共享与权限"中添加读取权限'
        ];
      case 'linux':
        return [
          '使用 chmod 命令修改文件权限',
          '或使用 chown 命令更改文件所有者',
          '或选择其他可读取的文件'
        ];
      default:
        return [
          '检查文件/文件夹的权限设置',
          '确保当前用户有读取权限',
          '尝试选择其他文件'
        ];
    }
  }

  /**
   * 推荐替代存储路径
   * @returns {string} 推荐的存储路径
   */
  getRecommendedStoragePath() {
    switch (this.platform) {
      case 'win32':
        return path.join(process.env.USERPROFILE, 'Documents', 'FanOutput');
      case 'darwin':
        return path.join(process.env.HOME, 'Documents', 'FanOutput');
      case 'linux':
        return path.join(process.env.HOME, 'Documents', 'FanOutput');
      default:
        return path.join(platform.getDownloadDir(), 'fan-output');
    }
  }

  /**
   * 验证并创建路径
   * @param {string} targetPath - 目标路径
   * @returns {Promise<object>} 验证结果
   */
  async validateAndCreatePath(targetPath) {
    try {
      // 检查路径是否存在
      const exists = await fs.pathExists(targetPath);
      
      if (!exists) {
        // 创建路径
        await fs.mkdirs(targetPath, { recursive: true });
        logger.info('路径创建成功', { targetPath });
      }

      // 验证权限
      const permissions = await this.detectPermissions(targetPath);
      
      return {
        success: true,
        path: targetPath,
        exists: exists,
        created: !exists,
        permissions: permissions
      };
    } catch (error) {
      logger.error('路径验证失败', { targetPath, error });
      return {
        success: false,
        error: error.message,
        path: targetPath
      };
    }
  }

  /**
   * 评估所需的权限级别
   * @param {string} action - 要执行的操作
   * @returns {string} 所需的权限级别
   */
  evaluateRequiredPermissionLevel(action) {
    for (const [level, config] of Object.entries(this.permissionLevels)) {
      if (config.allowedActions.includes(action)) {
        return level;
      }
    }
    return 'standard'; // 默认使用标准权限级别
  }

  /**
   * 检查权限是否满足操作需求
   * @param {object} permissionResult - 权限检测结果
   * @param {string} action - 要执行的操作
   * @returns {object} 权限检查结果
   */
  checkPermissionForAction(permissionResult, action) {
    if (!permissionResult.success) {
      return {
        hasPermission: false,
        requiredLevel: 'standard',
        currentLevel: 'none',
        missingPermissions: [],
        message: permissionResult.error
      };
    }

    const requiredLevel = this.evaluateRequiredPermissionLevel(action);
    const requiredPermissions = this.permissionLevels[requiredLevel].requiredPermissions;
    const currentPermissions = permissionResult.permissions;
    const missingPermissions = [];

    for (const perm of requiredPermissions) {
      if (!currentPermissions[perm]) {
        missingPermissions.push(perm);
      }
    }

    return {
      hasPermission: missingPermissions.length === 0,
      requiredLevel: requiredLevel,
      currentLevel: this._determineCurrentPermissionLevel(currentPermissions),
      missingPermissions: missingPermissions,
      message: missingPermissions.length > 0 
        ? `缺少必要的权限: ${missingPermissions.join(', ')}` 
        : '权限足够'
    };
  }

  /**
   * 确定当前权限级别
   * @param {object} permissions - 权限对象
   * @returns {string} 当前权限级别
   * @private
   */
  _determineCurrentPermissionLevel(permissions) {
    if (permissions.read && permissions.write && permissions.execute) {
      return 'advanced';
    } else if (permissions.read && permissions.write) {
      return 'standard';
    } else if (permissions.read) {
      return 'minimal';
    } else {
      return 'none';
    }
  }

  /**
   * 获取权限使用说明
   * @param {string} permission - 权限名称
   * @returns {object} 权限使用说明
   */
  getPermissionUsageExplanation(permission) {
    const explanations = {
      read: {
        description: '读取权限',
        purpose: '用于读取文件和目录内容，是所有操作的基础',
        requiredFor: ['扫描文件', '分析内容', '提取资源'],
        riskLevel: '低',
        howUsed: '仅在本地读取文件内容，不上传到任何服务器'
      },
      write: {
        description: '写入权限',
        purpose: '用于保存提取的资源和临时文件',
        requiredFor: ['保存提取的资源', '创建临时文件', '生成前端包'],
        riskLevel: '中',
        howUsed: '仅写入指定的输出目录，不修改原始文件'
      },
      execute: {
        description: '执行权限',
        purpose: '用于执行必要的系统命令',
        requiredFor: ['解包某些格式的文件', '运行系统工具'],
        riskLevel: '中',
        howUsed: '仅执行安全的系统命令，不执行用户提供的代码'
      }
    };

    return explanations[permission] || {
      description: permission,
      purpose: '未知权限',
      requiredFor: [],
      riskLevel: '未知',
      howUsed: '未知'
    };
  }

  /**
   * 获取所有权限的使用说明
   * @returns {object} 所有权限的使用说明
   */
  getAllPermissionExplanations() {
    const explanations = {};
    for (const perm of ['read', 'write', 'execute']) {
      explanations[perm] = this.getPermissionUsageExplanation(perm);
    }
    return explanations;
  }

  /**
   * 优化权限申请策略
   * @param {string} action - 要执行的操作
   * @returns {object} 权限申请策略
   */
  optimizePermissionRequestStrategy(action) {
    const requiredLevel = this.evaluateRequiredPermissionLevel(action);
    const requiredPermissions = this.permissionLevels[requiredLevel].requiredPermissions;
    const explanations = requiredPermissions.map(perm => this.getPermissionUsageExplanation(perm));

    return {
      action: action,
      requiredLevel: requiredLevel,
      requiredPermissions: requiredPermissions,
      permissionExplanations: explanations,
      strategy: {
        requestOnlyRequired: true,
        explainPurpose: true,
        provideAlternatives: this._getAlternativeActions(action),
        minimizeScope: true
      }
    };
  }

  /**
   * 获取替代操作
   * @param {string} action - 原始操作
   * @returns {array} 替代操作列表
   * @private
   */
  _getAlternativeActions(action) {
    const alternatives = {
      'execute': ['scan', 'analyze'],
      'modify': ['extract', 'save']
    };

    return alternatives[action] || [];
  }

  /**
   * 生成权限申请对话框内容
   * @param {string} action - 要执行的操作
   * @returns {object} 对话框内容
   */
  generatePermissionRequestContent(action) {
    const strategy = this.optimizePermissionRequestStrategy(action);
    
    let message = `执行此操作需要以下权限：`;
    let detail = '';

    for (const explanation of strategy.permissionExplanations) {
      detail += `• ${explanation.description}: ${explanation.purpose}\n`;
      detail += `  用途: ${explanation.requiredFor.join(', ')}\n`;
      detail += `  风险等级: ${explanation.riskLevel}\n\n`;
    }

    detail += `权限使用说明:\n`;
    detail += `• 所有操作均在本地完成\n`;
    detail += `• 仅访问必要的文件和目录\n`;
    detail += `• 不修改原始文件\n`;
    detail += `• 不收集或上传用户数据\n`;

    return {
      title: '权限申请',
      message: message,
      detail: detail,
      buttons: ['授予权限', '取消'],
      defaultId: 0,
      cancelId: 1
    };
  }
}


// 导出单例
module.exports = new PermissionManager();