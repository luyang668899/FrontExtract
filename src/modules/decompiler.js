const fs = require('fs-extra');
const os = require('os');
const { platform, performance } = require('./index');
const { js, css, html } = require('js-beautify');

class Decompiler {
  constructor() {
    this.frontendExtensions = {
      html: ['.html', '.htm'],
      css: ['.css'],
      js: ['.js', '.jsx', '.ts', '.tsx'],
      images: ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp'],
      fonts: ['.woff', '.woff2', '.ttf', '.otf'],
      config: ['.json', '.yaml', '.yml', '.xml']
    };
  }

  /**
   * 扫描目录中的前端文件
   * @param {string} directory - 目录路径
   * @returns {Promise<object>} 分类后的文件列表
   */
  async scanFrontendFiles(directory) {
    const files = {
      html: [],
      css: [],
      js: [],
      images: [],
      fonts: [],
      config: [],
      other: []
    };

    await this._scanDirectory(directory, files);
    return files;
  }

  /**
   * 递归扫描目录
   * @param {string} directory - 目录路径
   * @param {object} files - 文件分类对象
   */
  async _scanDirectory(directory, files) {
    try {
      const entries = await fs.readdir(directory, { withFileTypes: true });

      // 控制并发数，避免内存使用过高
      const concurrencyLimit = Math.max(1, Math.min(os.cpus().length, 4));
      
      // 分批处理条目
      const batchSize = 50;
      for (let i = 0; i < entries.length; i += batchSize) {
        const batch = entries.slice(i, i + batchSize);
        
        // 使用受控并发处理批次
        await performance.parallelProcess(batch, async (entry) => {
          const fullPath = platform.joinPath(directory, entry.name);

          if (entry.isDirectory()) {
            await this._scanDirectory(fullPath, files);
          } else if (entry.isFile()) {
            const ext = fullPath.slice(fullPath.lastIndexOf('.')).toLowerCase();
            let found = false;

            for (const [type, extensions] of Object.entries(this.frontendExtensions)) {
              if (extensions.includes(ext)) {
                files[type].push(fullPath);
                found = true;
                break;
              }
            }

            if (!found) {
              files.other.push(fullPath);
            }
          }
        }, concurrencyLimit);
        
        // 检查内存使用情况，必要时清理缓存
        if (performance.isMemoryUsageHigh()) {
          performance.smartClearMemoryCache(30);
        }
      }
    } catch (error) {
      console.error(`扫描目录失败 ${directory}:`, error);
    }
  }

  /**
   * 反编译前端文件
   * @param {string} filePath - 文件路径
   * @returns {Promise<string>} 反编译后的内容
   */
  async decompileFile(filePath) {
    const ext = filePath.slice(filePath.lastIndexOf('.')).toLowerCase();
    
    // 检查缓存
    const cachedContent = performance.getCachedFile(filePath);
    if (cachedContent) {
      return cachedContent;
    }

    try {
      // 使用流式读取大文件
      const content = await performance.streamReadFile(filePath);
      let result;

      if (this.frontendExtensions.js.includes(ext)) {
        result = this.beautifyJS(content);
      } else if (this.frontendExtensions.css.includes(ext)) {
        result = this.beautifyCSS(content);
      } else if (this.frontendExtensions.html.includes(ext)) {
        result = this.beautifyHTML(content);
      } else {
        result = content;
      }

      // 缓存结果
      performance.cacheFile(filePath, result);
      return result;
    } catch (error) {
      console.error(`反编译文件失败 ${filePath}:`, error);
      // 失败时尝试使用常规读取
      try {
        const content = await platform.readFile(filePath, 'utf8');
        return content;
      } catch {
        return '';
      }
    }
  }

  /**
   * 美化JS代码
   * @param {string} code - JS代码
   * @returns {string} 美化后的代码
   */
  beautifyJS(code) {
    return js(code, {
      indent_size: 2,
      space_in_empty_paren: true,
      preserve_newlines: true,
      max_preserve_newlines: 2
    });
  }

  /**
   * 美化CSS代码
   * @param {string} code - CSS代码
   * @returns {string} 美化后的代码
   */
  beautifyCSS(code) {
    return css(code, {
      indent_size: 2,
      space_in_empty_paren: true
    });
  }

  /**
   * 美化HTML代码
   * @param {string} code - HTML代码
   * @returns {string} 美化后的代码
   */
  beautifyHTML(code) {
    return html(code, {
      indent_size: 2,
      space_in_empty_paren: true,
      preserve_newlines: true,
      max_preserve_newlines: 2
    });
  }

  /**
   * 检测前端框架
   * @param {string} directory - 目录路径
   * @returns {Promise<string>} 框架名称
   */
  async detectFramework(directory) {
    const files = await this.scanFrontendFiles(directory);
    
    // 检查package.json
    const packageJsonPath = platform.joinPath(directory, 'package.json');
    if (platform.fileExists(packageJsonPath)) {
      const packageJson = await fs.readJson(packageJsonPath);
      const dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies };
      
      if (dependencies.vue) return 'vue';
      if (dependencies.react) return 'react';
      if (dependencies.angular) return 'angular';
    }

    // 检查文件内容
    for (const jsFile of files.js) {
      try {
        const content = await fs.readFile(jsFile, 'utf8');
        if (content.includes('import Vue') || content.includes('from \'vue\'')) return 'vue';
        if (content.includes('import React') || content.includes('from \'react\'')) return 'react';
        if (content.includes('import { Component } from \'@angular/core\'')) return 'angular';
      } catch {
        // 忽略文件读取错误
      }
    }

    return 'unknown';
  }

  /**
   * 生成前端入口文件
   * @param {string} outputDir - 输出目录
   * @param {string} framework - 框架名称
   * @returns {Promise<string>} 入口文件路径
   */
  async generateEntryFile(outputDir, framework) {
    const indexHtmlPath = platform.joinPath(outputDir, 'index.html');
    
    let htmlContent = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Extracted Frontend</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <div id="app"></div>
  <script src="script.js"></script>
</body>
</html>`;

    switch (framework) {
      case 'vue':
        htmlContent = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Vue App</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <div id="app"></div>
  <script type="module" src="script.js"></script>
</body>
</html>`;
        break;
      case 'react':
        htmlContent = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>React App</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <div id="root"></div>
  <script type="module" src="script.js"></script>
</body>
</html>`;
        break;
    }

    await fs.writeFile(indexHtmlPath, htmlContent);
    return indexHtmlPath;
  }

  /**
   * 重组前端资源
   * @param {string} sourceDir - 源目录
   * @param {string} outputDir - 输出目录
   * @param {object} options - 重组选项
   * @returns {Promise<object>} 重组结果
   */
  async reorganizeResources(sourceDir, outputDir, options = {}) {
    try {
      const { onProgress } = options;
      const files = await this.scanFrontendFiles(sourceDir);
      const framework = await this.detectFramework(sourceDir);
      const totalFiles = Object.values(files).flat().length;
      let processedFiles = 0;

      // 创建输出目录结构
      await platform.createDir(outputDir);
      await platform.createDir(platform.joinPath(outputDir, 'assets', 'images'));
      await platform.createDir(platform.joinPath(outputDir, 'assets', 'fonts'));
      await platform.createDir(platform.joinPath(outputDir, 'js'));
      await platform.createDir(platform.joinPath(outputDir, 'css'));

      // 复制和处理文件
      const fileTypes = [
        { files: files.html, dest: outputDir, type: 'HTML文件' },
        { files: files.css, dest: platform.joinPath(outputDir, 'css'), type: 'CSS文件' },
        { files: files.js, dest: platform.joinPath(outputDir, 'js'), type: 'JavaScript文件' },
        { files: files.images, dest: platform.joinPath(outputDir, 'assets', 'images'), type: '图片文件' },
        { files: files.fonts, dest: platform.joinPath(outputDir, 'assets', 'fonts'), type: '字体文件' },
        { files: files.config, dest: outputDir, type: '配置文件' }
      ];

      // 控制并发数，避免内存使用过高
      const concurrencyLimit = Math.max(1, Math.min(os.cpus().length, 4));

      for (const { files: typeFiles, dest, type } of fileTypes) {
        if (typeFiles.length > 0) {
          if (onProgress) {
            onProgress({ 
              step: 'reorganizing', 
              progress: 60 + Math.round((processedFiles / totalFiles) * 20), 
              message: `正在处理${type}...` 
            });
          }
          
          // 分批处理文件，根据文件类型调整批次大小
          const batchSize = this._isCodeFile(typeFiles[0]) ? 5 : 20; // 代码文件批次小一些，资源文件批次大一些
          
          for (let i = 0; i < typeFiles.length; i += batchSize) {
            const batch = typeFiles.slice(i, i + batchSize);
            
            // 使用受控并发处理批次
            await performance.parallelProcess(batch, async (file) => {
              try {
                const fileName = file.slice(file.lastIndexOf(platform.getPathSeparator()) + 1);
                const outputPath = platform.joinPath(dest, fileName);
                
                // 对于代码文件，先反编译再保存
                if (this._isCodeFile(file)) {
                  const decompiledContent = await this.decompileFile(file);
                  await platform.writeFile(outputPath, decompiledContent);
                  
                  // 处理完代码文件后清理缓存，减少内存使用
                  performance.smartClearMemoryCache(10);
                } else {
                  // 对于资源文件，直接复制
                  await platform.copy(file, outputPath);
                }
              } catch (error) {
                console.error(`复制文件失败 ${file}:`, error);
              }
            }, concurrencyLimit);
            
            processedFiles += batch.length;
            if (onProgress) {
              const progress = 60 + Math.round((processedFiles / totalFiles) * 20);
              onProgress({ 
                step: 'reorganizing', 
                progress, 
                message: `正在处理${type}... (${processedFiles}/${totalFiles})` 
              });
            }
            
            // 检查内存使用情况，必要时清理缓存
            if (performance.isMemoryUsageHigh()) {
              performance.smartClearMemoryCache(50);
            }
          }
        }
      }

      // 清理所有缓存，释放内存
      performance.clearMemoryCache();

      // 生成入口文件
      if (onProgress) {
        onProgress({ step: 'reorganizing', progress: 80, message: '正在生成入口文件...' });
      }
      await this.generateEntryFile(outputDir, framework);

      if (onProgress) {
        onProgress({ step: 'reorganizing', progress: 85, message: '资源重组完成' });
      }

      return {
        success: true,
        framework,
        files: totalFiles
      };
    } catch (error) {
      // 发生错误时清理缓存
      performance.clearMemoryCache();
      throw new Error(`重组资源失败: ${error.message}`);
    }
  }

  /**
   * 复制文件
   * @param {array} files - 文件路径数组
   * @param {string} outputDir - 输出目录
   */
  async _copyFiles(files, outputDir) {
    // 使用并行处理提升复制速度
    await performance.parallelProcess(files, async (file) => {
      try {
        const fileName = file.slice(file.lastIndexOf(platform.getPathSeparator()) + 1);
        const outputPath = platform.joinPath(outputDir, fileName);
        
        // 对于代码文件，先反编译再保存
        if (this._isCodeFile(file)) {
          const decompiledContent = await this.decompileFile(file);
          await platform.writeFile(outputPath, decompiledContent);
        } else {
          // 对于资源文件，直接复制
          await platform.copy(file, outputPath);
        }
      } catch (error) {
        console.error(`复制文件失败 ${file}:`, error);
      }
    });
  }

  /**
   * 判断是否为代码文件
   * @param {string} filePath - 文件路径
   * @returns {boolean} 是否为代码文件
   */
  _isCodeFile(filePath) {
    const ext = filePath.slice(filePath.lastIndexOf('.')).toLowerCase();
    return this.frontendExtensions.js.includes(ext) || 
           this.frontendExtensions.css.includes(ext) || 
           this.frontendExtensions.html.includes(ext);
  }
}

module.exports = Decompiler;