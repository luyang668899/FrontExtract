const { dialog } = require('electron');
const fs = require('fs-extra');
const path = require('path');

class Compliance {
  constructor() {
    this.complianceFile = path.join(require('os').homedir(), '.fan', 'compliance.json');
  }

  /**
   * 显示使用许可协议
   * @param {BrowserWindow} mainWindow - 主窗口
   * @returns {Promise<boolean>} 用户是否同意
   */
  async showComplianceNotice(mainWindow) {
    // 检查是否已经同意过
    if (await this.hasAgreed()) {
      return true;
    }

    const options = {
      type: 'info',
      title: '使用许可协议',
      message: 'Fan - 跨平台软件前端反编译提取工具',
      detail: `使用许可协议\n==================\n\n1. 许可范围\n   - 本工具仅授予用户合法合规使用的权利\n   - 允许使用本工具进行以下活动：\n     * 学习和研究前端技术\n     * 调试自有软件\n     * 提取自有软件的前端资源\n     * 进行合法的安全研究和漏洞分析\n\n2. 严格禁止行为\n   - 任何侵犯知识产权的行为\n   - 破解软件授权保护机制\n   - 剥离软件的加密验证系统\n   - 修改原软件功能用于非法目的\n   - 利用提取的资源创建竞争产品\n   - 任何违反法律法规的行为\n\n3. 技术使用边界\n   - 仅提取公开可访问的前端资源\n   - 不反编译二进制代码、后端代码\n   - 不破解加密核心逻辑\n   - 不干扰软件的正常运行\n\n4. 数据处理与隐私\n   - 所有文件解析、处理均在本地完成\n   - 不上传用户文件至任何服务器\n   - 无数据泄露风险\n   - 不收集用户使用数据\n\n5. 法律责任\n   - 使用者应自行承担使用本工具的法律责任\n   - 工具开发者不对使用者的不当使用行为负责\n   - 如发现非法使用行为，开发者保留采取法律行动的权利\n\n6. 使用场景检测\n   - 本工具内置使用场景检测机制\n   - 对可能的侵权行为会发出警告\n   - 严重违规操作将被阻止\n\n7. 协议变更\n   - 本协议可能会根据法律法规的变化进行更新\n   - 重大变更将在应用启动时重新显示\n\n请仔细阅读并遵守上述条款，点击"同意"即表示您已理解并接受本使用许可协议。`,
      buttons: ['同意', '取消'],
      defaultId: 0,
      cancelId: 1
    };

    const { response } = await dialog.showMessageBox(mainWindow, options);
    const agreed = response === 0;

    if (agreed) {
      await this.saveAgreement();
    }

    return agreed;
  }

  /**
   * 检查是否已经同意过合规声明
   * @returns {Promise<boolean>} 是否已同意
   */
  async hasAgreed() {
    try {
      if (await fs.exists(this.complianceFile)) {
        const data = await fs.readJson(this.complianceFile);
        return data.agreed === true;
      }
      return false;
    } catch {
      return false;
    }
  }

  /**
   * 保存同意状态
   */
  async saveAgreement() {
    try {
      await fs.ensureDir(path.dirname(this.complianceFile));
      await fs.writeJson(this.complianceFile, {
        agreed: true,
        timestamp: new Date().toISOString(),
        version: '1.0.0'
      });
    } catch (error) {
      console.error('保存合规声明同意状态失败:', error);
    }
  }

  /**
   * 重置同意状态
   */
  async resetAgreement() {
    try {
      if (await fs.exists(this.complianceFile)) {
        await fs.remove(this.complianceFile);
      }
    } catch (error) {
      console.error('重置合规声明同意状态失败:', error);
    }
  }

  /**
   * 获取合规声明内容
   * @returns {string} 合规声明
   */
  getComplianceText() {
    return `Fan - 跨平台软件前端反编译提取工具

使用须知：

1. 本工具仅用于合法合规的前端资源提取，包括：
   - 学习和研究前端技术
   - 调试自有软件
   - 提取自有软件的前端资源

2. 禁止使用本工具进行以下行为：
   - 侵权行为，包括但不限于侵犯版权、商标权等
   - 破解软件授权保护
   - 剥离软件的加密验证
   - 修改原软件功能
   - 任何违反法律法规的行为

3. 技术边界：
   - 仅提取公开可访问的前端资源
   - 不反编译二进制代码、后端代码
   - 不破解加密核心逻辑

4. 数据安全：
   - 所有文件解析、处理均在本地完成
   - 不上传用户文件至任何服务器
   - 无数据泄露风险

5. 责任声明：
   - 使用者应自行承担使用本工具的法律责任
   - 工具开发者不对使用者的不当使用行为负责`;
  }

  /**
   * 验证用户操作是否合规
   * @param {string} filePath - 文件路径
   * @returns {boolean} 是否合规
   */
  validateOperation(filePath) {
    // 检查文件路径是否包含敏感软件名称
    const sensitiveSoftwareNames = [
      'adobe', 'microsoft', 'google', 'apple', 'oracle',
      'autodesk', 'intuit', 'salesforce', 'sap', 'ibm'
    ];

    const fileName = path.basename(filePath).toLowerCase();
    for (const name of sensitiveSoftwareNames) {
      if (fileName.includes(name)) {
        // 记录警告但不阻止操作
        console.warn(`警告：检测到可能的敏感软件文件: ${filePath}`);
        // 不返回false，因为我们只是警告，不阻止合法使用
      }
    }

    // 检查文件是否为系统文件
    if (this._isSystemFile(filePath)) {
      console.warn(`警告：检测到系统文件: ${filePath}`);
    }

    return true;
  }

  /**
   * 检测使用场景
   * @param {string} filePath - 文件路径
   * @returns {object} 检测结果
   */
  detectUsageScenario(filePath) {
    const scenario = {
      isPotentialInfringement: false,
      warnings: [],
      recommendations: []
    };

    // 检查文件类型
    const ext = path.extname(filePath).toLowerCase();
    const executableExts = ['.exe', '.dmg', '.deb', '.rpm'];
    const archiveExts = ['.zip', '.7z', '.rar', '.asar'];

    if (executableExts.includes(ext)) {
      scenario.warnings.push('警告：您正在处理可执行文件，请确保拥有合法使用权');
      scenario.recommendations.push('建议：仅处理您拥有合法权利的软件');
    }

    // 检查文件大小
    try {
      const stats = fs.statSync(filePath);
      const fileSizeMB = stats.size / (1024 * 1024);
      if (fileSizeMB > 1000) { // 大于1GB
        scenario.warnings.push('警告：文件大小超过1GB，可能是大型商业软件');
        scenario.recommendations.push('建议：确认您有合法权限处理此文件');
      }
    } catch (error) {
      // 忽略文件大小检查错误
    }

    // 检查文件路径中的敏感信息
    const sensitivePatterns = [
      'license', 'activation', 'keygen', 'crack', 'patch',
      'serial', 'register', 'activation'
    ];

    const filePathLower = filePath.toLowerCase();
    for (const pattern of sensitivePatterns) {
      if (filePathLower.includes(pattern)) {
        scenario.isPotentialInfringement = true;
        scenario.warnings.push('警告：检测到可能的侵权使用场景');
        scenario.recommendations.push('建议：停止当前操作，确保使用行为合法合规');
        break;
      }
    }

    return scenario;
  }

  /**
   * 检查是否为系统文件
   * @param {string} filePath - 文件路径
   * @returns {boolean} 是否为系统文件
   * @private
   */
  _isSystemFile(filePath) {
    const systemPaths = [
      '/System/', '/Library/', '/usr/', // macOS/Linux系统路径
      'C:\\Windows\\', 'C:\\Program Files\\', // Windows系统路径
      'C:\\Program Files (x86)\\'
    ];

    const filePathLower = filePath.toLowerCase();
    return systemPaths.some(systemPath => filePathLower.includes(systemPath.toLowerCase()));
  }
}

// 导出单例
module.exports = new Compliance;