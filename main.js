/**
 * Fan - 跨平台软件前端反编译提取工具
 * 主进程文件，负责管理应用生命周期，创建浏览器窗口，处理IPC通信
 */

// 导入Electron核心模块
const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const os = require('os');

// 导入自定义模块
const { 
  platform, 
  logger, 
  errorHandler, 
  compliance, 
  security, 
  Engine, 
  permissionManager 
} = require('./src/modules');
const fs = require('fs-extra');

// 捕获全局错误
logger.captureGlobalErrors();

// 清理旧日志
logger.cleanOldLogs();

// 主窗口实例
let mainWindow;

/**
 * 创建主窗口
 * @returns {void}
 */
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 700,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,  // 禁用Node.js集成，提高安全性
      contextIsolation: true  // 启用上下文隔离，提高安全性
    },
    title: 'Fan - 跨平台软件前端反编译提取工具'
  });

  mainWindow.loadFile('index.html');
  // mainWindow.webContents.openDevTools(); // 开发时可取消注释以打开开发者工具
}

/**
 * 应用就绪时的回调函数
 * @returns {Promise<void>}
 */
app.whenReady().then(async () => {
  // 创建主窗口
  createWindow();

  // 显示合规声明
  const agreed = await compliance.showComplianceNotice(mainWindow);
  if (!agreed) {
    logger.info('用户拒绝合规声明，退出应用');
    app.quit();
    return;
  }

  logger.info('用户同意合规声明');

  // 当应用被激活时（如点击 Dock 图标），如果没有窗口则创建一个
  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

/**
 * 所有窗口关闭时的回调函数
 * @returns {void}
 */
app.on('window-all-closed', function () {
  // 在 macOS 上，应用和菜单栏通常保持活动状态，直到用户明确退出
  if (process.platform !== 'darwin') app.quit();
});

/**
 * 处理文件选择请求
 * @returns {Promise<string|null>} 选中的文件路径，取消选择则返回null
 */
ipcMain.handle('select-file', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [
      { name: '软件包文件', extensions: ['exe', 'dmg', 'deb', 'rpm', 'zip', '7z', 'rar', 'asar'] },
      { name: '所有文件', extensions: ['*'] }
    ]
  });
  return canceled ? null : filePaths[0];
});

/**
 * 处理文件夹选择请求
 * @returns {Promise<string|null>} 选中的文件夹路径，取消选择则返回null
 */
ipcMain.handle('select-folder', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory']
  });
  return canceled ? null : filePaths[0];
});

/**
 * 处理文件解析请求
 * @param {Electron.IpcMainInvokeEvent} event - IPC事件对象
 * @param {string} filePath - 要解析的文件路径
 * @param {string} customOutputPath - 自定义输出目录路径（可选）
 * @returns {Promise<object>} 解析结果对象
 * @returns {boolean} return.success - 解析是否成功
 * @returns {string} return.message - 解析结果消息
 * @returns {string} [return.outputPath] - 输出目录路径（成功时返回）
 * @returns {string} [return.framework] - 检测到的前端框架（成功时返回）
 * @returns {number} [return.fileCount] - 提取的文件数量（成功时返回）
 */
ipcMain.handle('parse-file', async (event, filePath, customOutputPath) => {
  try {
    logger.info('开始解析文件', { filePath, customOutputPath });
    
    // 验证文件路径是否存在
    if (!errorHandler.validateFilePath(filePath)) {
      throw new Error('文件不存在');
    }
    
    // 验证操作是否符合法律法规和道德规范
    if (!compliance.validateOperation(filePath)) {
      throw new Error('操作不合规');
    }
    
    // 检测使用场景
    const scenario = compliance.detectUsageScenario(filePath);
    if (scenario.warnings.length > 0) {
      logger.warn('使用场景检测警告', { warnings: scenario.warnings });
      if (mainWindow && !mainWindow.isDestroyed()) {
        // 显示警告消息
        for (const warning of scenario.warnings) {
          dialog.showMessageBox(mainWindow, {
            type: 'warning',
            title: '使用场景警告',
            message: warning,
            buttons: ['我知道了']
          });
        }
      }
    }
    
    // 如果检测到潜在的侵权行为，阻止操作
    if (scenario.isPotentialInfringement) {
      logger.error('检测到潜在的侵权行为', { filePath });
      throw new Error('检测到潜在的侵权使用场景，请确保您的操作合法合规');
    }
    
    // 验证文件安全性，防止恶意文件
    const securityValidation = await security.validateFile(filePath);
    if (!securityValidation.valid) {
      throw new Error(securityValidation.error);
    }
    
    // 执行基础文件安全扫描
    const scanResult = await security.scanFileSecurity(filePath);
    logger.info('文件安全扫描结果', { safe: scanResult.safe, riskLevel: scanResult.sourceInfo.riskLevel });
    
    // 显示安全扫描结果
    if (mainWindow && !mainWindow.isDestroyed()) {
      if (!scanResult.safe) {
        // 显示错误消息
        dialog.showMessageBox(mainWindow, {
          type: 'error',
          title: '安全扫描失败',
          message: '文件安全扫描失败',
          detail: scanResult.errors.join('\n'),
          buttons: ['确定']
        });
        throw new Error('文件安全扫描失败');
      } else if (scanResult.warnings.length > 0) {
        // 显示警告消息
        const warningMessage = scanResult.warnings.join('\n');
        const recommendations = security.getSecurityRecommendations(scanResult);
        const detail = `${warningMessage}\n\n安全建议:\n${recommendations.join('\n')}`;
        
        // 使用Promise处理用户选择
        const { response } = await dialog.showMessageBox(mainWindow, {
          type: 'warning',
          title: '安全扫描警告',
          message: '文件安全扫描发现潜在风险',
          detail: detail,
          buttons: ['继续处理', '取消']
        });
        if (response === 1) {
          throw new Error('用户取消处理');
        }
      } else {
        // 显示安全消息
        const recommendations = security.getSecurityRecommendations(scanResult);
        dialog.showMessageBox(mainWindow, {
          type: 'info',
          title: '安全扫描完成',
          message: '文件安全扫描完成',
          detail: `文件看起来安全，可以正常处理\n\n建议:\n${recommendations.join('\n')}`,
          buttons: ['确定']
        });
      }
    }
    
    // 记录文件来源
    await security.recordFileSource(filePath, 'user-selected');
    
    // 如果风险等级为高，阻止操作
    if (scanResult.sourceInfo.riskLevel === 'high') {
      logger.error('检测到高风险文件', { filePath });
      throw new Error('检测到高风险文件，可能包含恶意代码');
    }
    
    // 检查系统内存使用情况
    if (!security.checkMemoryUsage()) {
      throw new Error('内存使用过高，请关闭其他应用后重试');
    }
    
    // 执行文件解析
    const engine = new Engine();
    
    // 检查文件格式是否支持
    if (!engine.isSupported(filePath)) {
      throw new Error('不支持的文件格式');
    }
    
    // 生成输出目录路径
    const outputDir = customOutputPath || platform.joinPath(platform.getDownloadDir(), 'fan-output');
    await platform.createDir(outputDir);
    
    // 备份历史记录管理
    const backupManager = {
      async getBackupHistory() {
        const historyFile = path.join(os.homedir(), '.fan', 'backup-history.json');
        try {
          if (await fs.exists(historyFile)) {
            return await fs.readJson(historyFile);
          }
        } catch (error) {
          console.error('读取备份历史失败:', error);
        }
        return [];
      },
      
      async addBackupRecord(filePath) {
        const historyFile = path.join(os.homedir(), '.fan', 'backup-history.json');
        try {
          await fs.ensureDir(path.dirname(historyFile));
          const history = await this.getBackupHistory();
          history.push({
            filePath,
            timestamp: new Date().toISOString(),
            type: 'manual'
          });
          // 只保留最近10条记录
          const recentHistory = history.slice(-10);
          await fs.writeJson(historyFile, recentHistory);
        } catch (error) {
          console.error('添加备份记录失败:', error);
        }
      }
    };
    
    // 验证输出目录是否有写入权限
    if (!errorHandler.validateDirectoryPermission(outputDir)) {
      throw new Error('权限不足，无法写入输出目录');
    }
    
    // 检查权限是否满足操作需求
    const permissionResult = await permissionManager.detectPermissions(outputDir);
    const action = 'save'; // 保存操作
    const permissionCheck = permissionManager.checkPermissionForAction(permissionResult, action);
    
    if (!permissionCheck.hasPermission) {
      // 显示权限申请对话框
      const dialogContent = permissionManager.generatePermissionRequestContent(action);
      dialogContent.buttons = ['继续', '取消'];
      
      const { response } = await dialog.showMessageBox(mainWindow, dialogContent);
      if (response === 1) {
        throw new Error('用户取消操作');
      }
      
      // 再次检查权限
      const updatedPermissionResult = await permissionManager.detectPermissions(outputDir);
      const updatedCheck = permissionManager.checkPermissionForAction(updatedPermissionResult, action);
      if (!updatedCheck.hasPermission) {
        throw new Error(`权限不足: ${updatedCheck.message}`);
      }
    }
    
    // 显示权限使用说明
    if (mainWindow && !mainWindow.isDestroyed()) {
      const explanations = permissionManager.getAllPermissionExplanations();
      let detail = '权限使用说明:\n\n';
      
      for (const [perm, explanation] of Object.entries(explanations)) {
        detail += `• ${explanation.description}: ${explanation.purpose}\n`;
        detail += `  风险等级: ${explanation.riskLevel}\n`;
        detail += `  使用方式: ${explanation.howUsed}\n\n`;
      }
      
      dialog.showMessageBox(mainWindow, {
        type: 'info',
        title: '权限使用说明',
        message: 'Fan - 权限使用说明',
        detail: detail,
        buttons: ['我知道了']
      });
    }
    
    // 检查输出目录所在磁盘是否有足够空间
    if (!errorHandler.checkDiskSpace(outputDir)) {
      throw new Error('磁盘空间不足');
    }
    
    // 执行文件解析
    const result = await engine.parsePackage(filePath, outputDir, {
      format: 'folder',
      onProgress: (progress) => {
        // 发送进度更新到渲染进程
        event.sender.send('progress', progress);
      },
      onBackupPrompt: async () => {
        // 显示数据备份提示
        const backupHistory = await backupManager.getBackupHistory();
        let backupHistoryText = '最近备份记录:\n';
        
        if (backupHistory.length > 0) {
          const recentBackups = backupHistory.slice(-3); // 显示最近3条备份记录
          for (const backup of recentBackups) {
            const date = new Date(backup.timestamp).toLocaleString();
            backupHistoryText += `- ${date}: ${path.basename(backup.filePath)}\n`;
          }
        } else {
          backupHistoryText += '无备份记录\n';
        }
        
        const { response, checkboxChecked } = await dialog.showMessageBox(mainWindow, {
          type: 'warning',
          title: '数据备份提示',
          message: '在执行文件提取操作前，请确保已备份重要数据',
          detail: `重要提示:\n\n` +
                 `1. 文件提取操作可能会修改或覆盖现有文件\n` +
                 `2. 建议在操作前备份原始文件和目标目录\n` +
                 `3. 对于大型文件，建议使用外部存储设备进行备份\n` +
                 `\n${backupHistoryText}\n` +
                 `是否已完成备份并准备继续？`,
          buttons: ['已备份，继续', '取消'],
          defaultId: 0,
          cancelId: 1,
          checkboxLabel: '不再提示（本次会话）',
          checkboxChecked: false
        });
        
        if (response === 0) {
          // 添加备份记录
          await backupManager.addBackupRecord(filePath);
          return true;
        } else {
          return false;
        }
      }
    });
    
    logger.info('解析完成', { result });
    return {
      success: true,
      message: '解析成功',
      outputPath: result.outputPath,
      framework: result.framework,
      fileCount: result.fileCount
    };
  } catch (error) {
    // 处理错误并返回友好的错误信息
    const handledError = await errorHandler.handleError(error, 'parse-file');
    return { success: false, message: handledError.error.message };
  }
});

/**
 * 处理打开输出目录请求
 * @param {Electron.IpcMainInvokeEvent} event - IPC事件对象
 * @param {string} outputPath - 要打开的输出目录路径
 * @returns {Promise<object>} 操作结果对象
 * @returns {boolean} return.success - 操作是否成功
 * @returns {string} [return.message] - 错误消息（失败时返回）
 */
ipcMain.handle('open-output-dir', async (event, outputPath) => {
  try {
    logger.info('打开输出目录', { outputPath });
    
    // 验证目录路径是否存在
    if (!errorHandler.validateFilePath(outputPath)) {
      throw new Error('目录不存在');
    }
    
    const { shell } = require('electron');
    await shell.openPath(outputPath);
    logger.info('打开目录成功', { outputPath });
    return { success: true };
  } catch (error) {
    const handledError = await errorHandler.handleError(error, 'open-output-dir');
    return { success: false, message: handledError.error.message };
  }
});

/**
 * 处理权限检测请求
 * @param {Electron.IpcMainInvokeEvent} event - IPC事件对象
 * @param {string} targetPath - 要检测权限的目标路径
 * @returns {Promise<object>} 权限检测结果
 * @returns {boolean} return.success - 检测是否成功
 * @returns {object} [return.result] - 权限检测详细结果（成功时返回）
 * @returns {object} [return.solution] - 权限问题解决方案（成功时返回）
 * @returns {string} [return.message] - 错误消息（失败时返回）
 */
ipcMain.handle('detect-permissions', async (event, targetPath) => {
  try {
    logger.info('检测权限', { targetPath });
    const result = await permissionManager.detectPermissions(targetPath);
    const solution = permissionManager.getPermissionSolution(result);
    return {
      success: true,
      result: result,
      solution: solution
    };
  } catch (error) {
    const handledError = await errorHandler.handleError(error, 'detect-permissions');
    return { success: false, message: handledError.error.message };
  }
});

/**
 * 处理路径验证和创建请求
 * @param {Electron.IpcMainInvokeEvent} event - IPC事件对象
 * @param {string} targetPath - 要验证和创建的目标路径
 * @returns {Promise<object>} 验证和创建结果
 * @returns {boolean} return.success - 操作是否成功
 * @returns {string} [return.message] - 错误消息（失败时返回）
 */
ipcMain.handle('validate-and-create-path', async (event, targetPath) => {
  try {
    logger.info('验证并创建路径', { targetPath });
    const result = await permissionManager.validateAndCreatePath(targetPath);
    return result;
  } catch (error) {
    const handledError = await errorHandler.handleError(error, 'validate-and-create-path');
    return { success: false, message: handledError.error.message };
  }
});

/**
 * 处理获取推荐存储路径请求
 * @param {Electron.IpcMainInvokeEvent} event - IPC事件对象
 * @returns {Promise<object>} 推荐路径结果
 * @returns {boolean} return.success - 操作是否成功
 * @returns {string} [return.path] - 推荐的存储路径（成功时返回）
 * @returns {string} [return.message] - 错误消息（失败时返回）
 */
ipcMain.handle('get-recommended-path', async (event) => {
  try {
    const recommendedPath = permissionManager.getRecommendedStoragePath();
    return {
      success: true,
      path: recommendedPath
    };
  } catch (error) {
    const handledError = await errorHandler.handleError(error, 'get-recommended-path');
    return { success: false, message: handledError.error.message };
  }
});

/**
 * 处理磁盘状态检测请求
 * @param {Electron.IpcMainInvokeEvent} event - IPC事件对象
 * @param {string} dirPath - 要检测的目录路径
 * @returns {Promise<object>} 磁盘状态检测结果
 * @returns {boolean} return.success - 检测是否成功
 * @returns {object} [return.total] - 总磁盘空间（成功时返回）
 * @returns {object} [return.free] - 可用磁盘空间（成功时返回）
 * @returns {object} [return.used] - 已用磁盘空间（成功时返回）
 * @returns {object} [return.usage] - 磁盘使用百分比（成功时返回）
 * @returns {string} [return.message] - 错误消息（失败时返回）
 */
ipcMain.handle('detect-disk-status', async (event, dirPath) => {
  try {
    logger.info('检测磁盘状态', { dirPath });
    const result = await permissionManager.detectDiskStatus(dirPath);
    return result;
  } catch (error) {
    const handledError = await errorHandler.handleError(error, 'detect-disk-status');
    return { success: false, message: handledError.error.message };
  }
});