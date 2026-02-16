# Fan 项目开发文档

## 项目简介

Fan 是一个跨平台软件前端反编译提取工具，支持从各种软件包中提取、解析和还原前端资源。

### 主要功能

- 支持 Windows/macOS/Linux 平台
- 通过拖拽或文件选择方式导入软件包
- 自动解析、提取和还原前端资源（HTML/CSS/JS/静态资源/配置文件）
- 输出完整的前端包，可本地打开
- 内置权限管理工具，解决文件系统权限问题
- 符合 Electron 安全最佳实践

## 技术架构

### 核心技术栈

- Electron：跨平台桌面应用框架
- Node.js：JavaScript 运行时
- HTML/CSS/JavaScript：前端界面
- fs-extra：增强的文件系统操作
- adm-zip：ZIP 文件处理
- extract-zip：ZIP 文件提取
- js-beautify：代码美化
- uglify-js：JavaScript 压缩工具

### 开发框架

#### 前端开发框架
本项目采用原生 HTML/CSS/JavaScript 进行前端界面开发，不依赖第三方前端框架（如 React、Vue、Angular 等）。这种选择的优势在于：
- **轻量性**：减少依赖，降低应用体积
- **直接性**：直接操作 DOM，减少抽象层
- **兼容性**：更好的跨平台兼容性
- **学习成本低**：不需要学习特定框架的语法和特性

#### 桌面应用框架
- **Electron**：作为核心桌面应用框架，提供了以下能力：
  - 跨平台运行（Windows/macOS/Linux）
  - 原生桌面应用体验
  - Node.js 运行时集成
  - Chromium 渲染引擎
  - 主进程与渲染进程分离的架构

#### 开发工具链
- **构建工具**：
  - Vite：前端构建工具，提供快速的开发体验
  - electron-vite：Electron 专用的构建工具
- **打包工具**：
  - electron-builder：负责应用的打包和分发
  - 支持多平台打包（Windows/macOS/Linux）
- **代码质量工具**：
  - js-beautify：用于代码美化，提高代码可读性
  - uglify-js：用于 JavaScript 代码压缩

#### 开发流程
1. **环境搭建**：克隆仓库 → 安装依赖 → 启动开发模式
2. **代码开发**：遵循模块化设计原则，单一职责原则
3. **测试验证**：功能测试 → 性能测试 → 安全测试
4. **打包发布**：构建应用 → 测试构建结果 → 发布版本

#### 开发规范
- **代码风格**：使用 ES6+ 语法，遵循 JavaScript 标准风格
- **命名规范**：函数和变量命名清晰，使用语义化命名
- **文件结构**：模块化设计，按功能划分目录
- **注释规范**：关键代码添加注释，提高代码可维护性
- **安全规范**：遵循 Electron 安全最佳实践，确保应用安全

### 项目结构

```
fan/
├── main.js              # Electron 主进程
├── preload.js           # 预加载脚本，用于安全的进程间通信
├── index.html           # 主界面
├── src/
│   ├── modules/
│   │   ├── platform.js       # 跨平台适配模块
│   │   ├── unpacker.js       # 解包模块
│   │   ├── decompiler.js     # 反编译模块
│   │   ├── engine.js         # 核心引擎
│   │   ├── logger.js         # 日志模块
│   │   ├── errorHandler.js   # 错误处理模块
│   │   ├── compliance.js     # 合规性检查模块
│   │   ├── security.js       # 安全检查模块
│   │   ├── performance.js    # 性能优化模块
│   │   └── permissionManager.js  # 权限管理模块
├── docs/                # 文档目录
├── package.json         # 项目配置
└── node_modules/        # 依赖包
```

## 核心模块说明

### 1. 主进程 (main.js)

- **功能**：管理应用生命周期，创建浏览器窗口，处理 IPC 通信
- **关键组件**：
  - `createWindow()`：创建主窗口
  - IPC 事件处理：处理来自渲染进程的请求
  - 合规性检查：确保操作合法合规
  - 安全验证：验证文件安全性
  - 备份管理器：跟踪备份历史，管理备份记录
  - 权限请求对话框：生成和显示权限使用说明
  - 安全扫描集成：执行文件安全分析和风险评估
  - 使用场景检测：识别潜在的侵权使用场景

### 2. 预加载脚本 (preload.js)

- **功能**：安全地暴露 Electron API 到渲染进程
- **关键组件**：
  - `contextBridge.exposeInMainWorld()`：安全暴露 API
  - 暴露的方法：selectFile、selectFolder、parseFile、openOutputDir、onProgress 等

### 3. 渲染进程 (index.html)

- **功能**：提供用户界面，处理用户交互
- **关键组件**：
  - 拖拽功能：支持文件拖拽导入
  - 文件选择：通过对话框选择文件
  - 权限管理工具：可视化解决权限问题
  - 进度显示：显示解析进度
  - 结果展示：展示解析结果

### 4. 核心引擎模块 (engine.js)

- **功能**：协调各个模块，执行完整的解析流程，包括文件解包、前端资源扫描、资源重组、前端包生成等步骤
- **关键组件**：
  - `parsePackage(filePath, outputDir, options)`：解析软件包并提取前端资源
    - **参数**：
      - `filePath`：软件包路径
      - `outputDir`：输出目录
      - `options`：解析选项
        - `format`：输出格式，可选值：'folder' 或 'zip'
        - `onProgress`：进度回调函数
        - `onBackupPrompt`：备份提示回调函数
    - **返回值**：Promise<object>，解析结果
      - `success`：解析是否成功
      - `message`：解析结果消息
      - `outputPath`：输出目录路径
      - `framework`：检测到的前端框架
      - `fileCount`：提取的文件数量
      - `packageInfo`：包信息
  - 输出路径评估：评估输出路径的性能和可靠性
  - 系统资源检查：检查系统资源是否足够处理文件
  - 资源监控：监控解析过程中的系统资源使用情况
  - 并行处理：使用并行处理提升资源重组速度
  - 内存缓存清理：智能清理内存缓存，优化内存使用
  - `isSupported(filePath)`：检查文件是否支持
    - **参数**：
      - `filePath`：文件路径
    - **返回值**：boolean，是否支持
  - `getSupportedFormats()`：获取支持的文件格式
    - **返回值**：object，支持的文件格式
  - `_initTempDir()`：初始化临时目录
  - `_cleanupTempDir()`：清理临时目录

### 5. 解包模块 (unpacker.js)

- **功能**：从各种格式的软件包中提取文件，支持主流格式的解析和资源提取
- **支持的格式**：
  - ZIP 格式：.zip、.asar
  - Electron 应用：.exe、.dmg、.deb、.rpm
- **关键组件**：
  - `detectFormat(filePath)`：检测文件格式
    - **参数**：
      - `filePath`：文件路径
    - **返回值**：string，格式类型
  - `unpack(filePath, outputDir, options)`：根据格式选择解包方法
    - **参数**：
      - `filePath`：文件路径
      - `outputDir`：输出目录
      - `options`：解包选项
        - `isLargeFile`：是否为大型文件
        - `onProgress`：进度回调函数
    - **返回值**：Promise<string>，解包后的目录路径
  - `unpackZip(filePath, outputDir, options)`：解包 ZIP 文件
    - **参数**：
      - `filePath`：文件路径
      - `outputDir`：输出目录
      - `options`：解包选项
    - **返回值**：Promise<string>，解包后的目录路径
  - `unpackAsar(filePath, outputDir, options)`：解包 ASAR 文件
    - **参数**：
      - `filePath`：文件路径
      - `outputDir`：输出目录
      - `options`：解包选项
    - **返回值**：Promise<string>，解包后的目录路径
  - `unpackElectron(filePath, outputDir, options)`：解包 Electron 应用
    - **参数**：
      - `filePath`：文件路径
      - `outputDir`：输出目录
      - `options`：解包选项
    - **返回值**：Promise<string>，解包后的目录路径
  - `unpackDmg(filePath, outputDir)`：解包 DMG 文件
    - **参数**：
      - `filePath`：文件路径
      - `outputDir`：输出目录
    - **返回值**：Promise<string>，解包后的目录路径
  - `unpackLinuxPackage(filePath, outputDir)`：解包 Linux 包
    - **参数**：
      - `filePath`：文件路径
      - `outputDir`：输出目录
    - **返回值**：Promise<string>，解包后的目录路径
  - `cleanup(tempDir)`：清理临时文件
    - **参数**：
      - `tempDir`：临时目录
    - **返回值**：Promise<void>

### 6. 反编译模块 (decompiler.js)

- **功能**：解析和美化前端代码，扫描前端资源，检测前端框架，重组前端资源
- **关键组件**：
  - `scanFrontendFiles(directory)`：扫描目录中的前端文件
    - **参数**：
      - `directory`：目录路径
    - **返回值**：Promise<object>，分类后的文件列表
  - `decompileFile(filePath)`：反编译文件
    - **参数**：
      - `filePath`：文件路径
    - **返回值**：Promise<string>，反编译后的内容
  - `detectFramework(directory)`：检测前端框架
    - **参数**：
      - `directory`：目录路径
    - **返回值**：Promise<string>，框架名称
  - `reorganizeResources(sourceDir, outputDir, options)`：重组前端资源
    - **参数**：
      - `sourceDir`：源目录
      - `outputDir`：输出目录
      - `options`：重组选项
        - `onProgress`：进度回调函数
    - **返回值**：Promise<object>，重组结果
      - `success`：重组是否成功
      - `framework`：检测到的前端框架
      - `files`：提取的文件数量
  - `generateEntryFile(outputDir, framework)`：生成前端入口文件
    - **参数**：
      - `outputDir`：输出目录
      - `framework`：框架名称
    - **返回值**：Promise<string>，入口文件路径
  - `_isCodeFile(filePath)`：判断是否为代码文件
    - **参数**：
      - `filePath`：文件路径
    - **返回值**：boolean，是否为代码文件
  - `_copyFiles(files, outputDir)`：复制文件
    - **参数**：
      - `files`：文件路径数组
      - `outputDir`：输出目录
    - **返回值**：Promise<void>
  - `beautifyJS(code)`：美化 JS 代码
    - **参数**：
      - `code`：JS 代码
    - **返回值**：string，美化后的代码
  - `beautifyCSS(code)`：美化 CSS 代码
    - **参数**：
      - `code`：CSS 代码
    - **返回值**：string，美化后的代码
  - `beautifyHTML(code)`：美化 HTML 代码
    - **参数**：
      - `code`：HTML 代码
    - **返回值**：string，美化后的代码

### 7. 打包模块 (packer.js)

- **功能**：生成前端包，验证前端包完整性，获取包信息
- **关键组件**：
  - `generateFrontendPackage(sourceDir, outputPath, format, options)`：生成前端包
    - **参数**：
      - `sourceDir`：源目录路径
      - `outputPath`：输出路径
      - `format`：输出格式：'folder' 或 'zip'
      - `options`：生成选项
        - `onProgress`：进度回调函数
    - **返回值**：Promise<string>，输出路径
  - `validateFrontendPackage(packagePath)`：验证前端包完整性
    - **参数**：
      - `packagePath`：前端包路径
    - **返回值**：Promise<object>，验证结果
      - `success`：验证是否成功
      - `message`：验证结果消息
  - `getPackageInfo(packagePath)`：获取前端包信息
    - **参数**：
      - `packagePath`：前端包路径
    - **返回值**：Promise<object>，包信息
      - `success`：获取是否成功
      - `info`：包信息
  - `_formatSize(bytes)`：格式化文件大小
    - **参数**：
      - `bytes`：字节数
    - **返回值**：string，格式化后的大小

### 8. 权限管理模块 (permissionManager.js)

- **功能**：检测和解决文件系统权限问题
- **关键组件**：
  - `detectPermissions()`：检测权限
  - `detectDiskStatus()`：检测磁盘状态
  - `getPermissionSolution()`：获取解决方案
  - `validateAndCreatePath()`：验证并创建路径
  - `evaluateRequiredPermissionLevel(action)`：评估所需的权限级别
  - `checkPermissionForAction(permissionResult, action)`：检查权限是否满足操作需求
  - `getPermissionUsageExplanation(permission)`：获取权限使用说明
  - `optimizePermissionRequestStrategy(action)`：优化权限申请策略
  - `generatePermissionRequestContent(action)`：生成权限申请对话框内容

### 9. 性能优化模块 (performance.js)

- **功能**：优化应用性能，管理内存使用，清理临时文件
- **关键组件**：
  - `parallelProcess(files, processor, concurrency)`：并行处理文件
  - `streamReadFile(filePath)`：流式读取文件
  - `streamWriteFile(filePath, content)`：流式写入文件
  - `cacheFile(filePath, content)`：缓存文件内容
  - `getCachedFile(filePath)`：获取缓存的文件内容
  - `clearMemoryCache()`：清理内存缓存
  - `smartClearMemoryCache(percentage)`：智能清理内存缓存
  - `getCacheStats()`：获取缓存使用情况
  - `tempFileManager`：临时文件管理器
    - `registerTempFile(filePath)`：注册临时文件
    - `cleanupTempFiles()`：清理临时文件
    - `cleanupSystemTempFiles()`：清理系统临时文件
    - `getStats()`：获取临时文件统计信息
    - `manualCleanup()`：手动清理所有临时文件

### 10. 资源监控模块 (resourceMonitor.js)

- **功能**：监控系统资源使用情况，检测后台应用程序
- **关键组件**：
  - `startMonitoring(interval, callback)`：开始监控资源使用情况
  - `stopMonitoring()`：停止监控资源使用情况
  - `getResourceUsage()`：获取当前资源使用情况
  - `checkResourceThresholds(resourceUsage)`：检查资源使用是否超过阈值
  - `checkSystemResources(fileSize)`：检查系统是否有足够资源处理大型文件
  - `detectBackgroundApplications()`：检测后台应用程序
  - `detectAndSuggestClosingApplications()`：检测并提示关闭非核心应用程序

### 11. 安全模块 (security.js)

- **功能**：验证文件安全性，扫描文件内容，评估风险等级
- **关键组件**：
  - `validateFile(filePath)`：验证文件安全性
  - `safeReadFile(filePath, options)`：安全地读取文件
  - `safeWriteFile(filePath, content)`：安全地写入文件
  - `scanFileSecurity(filePath)`：扫描文件安全性
  - `calculateFileHash(filePath)`：计算文件哈希
  - `recordFileSource(filePath, source)`：记录文件来源
  - `getSecurityRecommendations(scanResult)`：获取文件安全建议

### 12. 合规性模块 (compliance.js)

- **功能**：确保操作合法合规，检测使用场景
- **关键组件**：
  - `showComplianceNotice(mainWindow)`：显示使用许可协议
  - `validateOperation(filePath)`：验证用户操作是否合规
  - `detectUsageScenario(filePath)`：检测使用场景
  - `getComplianceText()`：获取合规声明内容

### 13. 跨平台适配模块 (platform.js)

- **功能**：提供跨平台的文件系统操作，适配不同操作系统的文件系统差异
- **关键组件**：
  - `joinPath(...args)`：跨平台路径拼接
    - **参数**：
      - `...args`：路径片段
    - **返回值**：string，拼接后的路径
  - `createDir(dirPath)`：创建目录
    - **参数**：
      - `dirPath`：目录路径
    - **返回值**：Promise<void>
  - `copy(source, dest)`：复制文件或目录
    - **参数**：
      - `source`：源路径
      - `dest`：目标路径
    - **返回值**：Promise<void>
  - `readFile(filePath, encoding)`：读取文件
    - **参数**：
      - `filePath`：文件路径
      - `encoding`：编码方式
    - **返回值**：Promise<string>，文件内容
  - `writeFile(filePath, content, encoding)`：写入文件
    - **参数**：
      - `filePath`：文件路径
      - `content`：文件内容
      - `encoding`：编码方式
    - **返回值**：Promise<void>
  - `fileExists(filePath)`：检查文件是否存在
    - **参数**：
      - `filePath`：文件路径
    - **返回值**：boolean，是否存在
  - `remove(path)`：删除文件或目录
    - **参数**：
      - `path`：路径
    - **返回值**：Promise<void>
  - `getTempDir()`：获取临时目录
    - **返回值**：string，临时目录路径
  - `getPathSeparator()`：获取路径分隔符
    - **返回值**：string，路径分隔符
  - `evaluateOutputPath(outputPath)`：评估输出路径
    - **参数**：
      - `outputPath`：输出路径
    - **返回值**：object，路径评估结果
      - `exists`：路径是否存在
      - `isNetworkDrive`：是否为网络驱动器
      - `isExternalStorage`：是否为外部存储设备
      - `recommendedPath`：推荐的本地高速存储路径
      - `warnings`：警告信息数组

## 安全最佳实践

1. **进程隔离**：
   - 使用 `contextIsolation: true` 隔离渲染进程
   - 使用 `nodeIntegration: false` 禁用 Node.js 集成
   - 通过 preload.js 安全暴露 API

2. **权限管理**：
   - 实现权限检测和解决方案
   - 避免直接修改系统权限
   - 提供推荐存储路径

3. **输入验证**：
   - 验证文件路径
   - 检查文件安全性
   - 验证操作合规性

4. **错误处理**：
   - 全局错误捕获
   - 详细的错误分类和处理
   - 用户友好的错误提示

## 开发指南

### 环境搭建

1. 克隆项目：`git clone <repository-url>`
2. 安装依赖：`npm install`
3. 启动开发模式：`npm run dev`
4. 构建应用：`npm run build`

### 代码规范

- 使用 ES6+ 语法
- 遵循 JavaScript 标准风格
- 函数和变量命名清晰
- 模块化设计，单一职责原则

### 调试技巧

1. **主进程调试**：
   - 在 `main.js` 中添加 `mainWindow.webContents.openDevTools()`

2. **渲染进程调试**：
   - 使用 Chrome DevTools（在应用中按 F12）

3. **日志查看**：
   - 检查控制台输出
   - 查看日志文件

### 打包发布

1. **打包命令**：
   - 通用：`npm run package`
   - Windows：`npm run package:win`
   - macOS：`npm run package:mac`
   - Linux：`npm run package:linux`

2. **打包配置**：
   - 在 `package.json` 的 `build` 字段中配置

## 常见问题

### 1. 权限不足错误

**原因**：文件系统权限限制
**解决方案**：使用内置的权限管理工具检测和解决权限问题

### 2. 不支持的文件格式

**原因**：文件格式不在支持列表中
**解决方案**：检查文件格式，确保它是支持的格式

### 3. 解包失败

**原因**：文件损坏或格式不兼容
**解决方案**：检查文件完整性，尝试其他文件

### 4. 内存使用过高

**原因**：文件过大或系统资源不足
**解决方案**：关闭其他应用，尝试较小的文件

## 未来规划

1. **支持更多文件格式**：扩展对其他格式的支持
2. **增强解析能力**：提高对复杂前端框架的解析能力
3. **优化性能**：进一步优化大型文件的处理速度
4. **添加更多功能**：如批量处理、自定义输出格式等
5. **改进用户界面**：提供更直观、更美观的界面

## 贡献指南

1. Fork 项目
2. 创建特性分支
3. 提交更改
4. 推送到分支
5. 创建 Pull Request

## 免责声明与使用警告

**重要声明：请所有用户及开发者务必仔细阅读以下内容**

### 合法使用声明

本项目仅用于合法的学习、研究和开发目的。项目作者设计和开发本工具的初衷是为了帮助开发者学习前端技术、分析前端架构、以及在合法授权的情况下进行代码审查和安全测试。

### 禁止行为

**严格禁止**使用本项目进行以下活动：

- **盗用版权**：提取、修改和使用他人拥有版权的前端代码，未经授权用于商业或非商业用途
- **侵犯知识产权**：侵犯他人的专利、商标、商业秘密或其他知识产权
- **违反法律法规**：违反任何国家或地区的法律法规，包括但不限于计算机安全、知识产权保护、网络安全等相关法律
- **恶意破解**：用于破解、绕过付费墙、解锁限制内容等恶意行为
- **侵犯隐私**：提取、收集或滥用他人的个人信息或隐私数据
- **破坏系统**：用于破坏、干扰或攻击计算机系统、网络或服务

### 责任声明

任何个人或组织使用本项目进行违法违规活动，均与项目作者无关。项目作者不对任何因不当使用本项目而产生的法律责任、经济损失或其他后果承担责任。

### 使用前注意事项

在使用本工具前，请确保：

1. **获得授权**：如果提取的是他人的前端代码，请确保您已获得合法授权
2. **符合法律法规**：您的使用行为符合当地法律法规及道德规范
3. **尊重知识产权**：尊重他人的知识产权，不进行任何侵权行为
4. **风险自担**：了解并承担使用本工具可能带来的风险

### 开发者责任

如果您是本项目的开发者或贡献者：

1. **遵守开源协议**：确保您的贡献符合项目的开源协议
2. **维护项目初衷**：保持项目的合法用途，不添加任何用于非法活动的功能
3. **提醒用户**：在相关文档和界面中明确提醒用户合法使用本工具

### 法律后果

使用本工具进行违法活动可能导致严重的法律后果，包括但不限于：

- **民事责任**：被要求赔偿经济损失、停止侵权行为等
- **行政责任**：受到行政处罚，如罚款、没收违法所得等
- **刑事责任**：可能面临监禁、罚金等刑事处罚

### 最终解释权

本免责声明的最终解释权归项目作者所有。项目作者有权根据法律法规的变化和项目的发展，随时修改本免责声明的内容。

## 许可证

MIT License
