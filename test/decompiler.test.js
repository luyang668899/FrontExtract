const path = require('path');
const Decompiler = require('../src/modules/decompiler');

// 简化mock设置
jest.mock('fs-extra', () => ({
  readdir: jest.fn().mockResolvedValue([]),
  readFile: jest.fn().mockResolvedValue('test content'),
  writeFile: jest.fn().mockResolvedValue(true),
  readJson: jest.fn().mockResolvedValue({ dependencies: {} }),
  ensureDir: jest.fn().mockResolvedValue(true)
}));

jest.mock('../src/modules/platform', () => ({
  joinPath: jest.fn((...args) => args.join('/')),
  fileExists: jest.fn().mockReturnValue(false),
  createDir: jest.fn().mockResolvedValue(true),
  writeFile: jest.fn().mockResolvedValue(true),
  copy: jest.fn().mockResolvedValue(true),
  readFile: jest.fn().mockResolvedValue('test content'),
  evaluateOutputPath: jest.fn().mockReturnValue({
    warnings: [],
    recommendedPath: '/mock/recommended/path'
  })
}));

jest.mock('../src/modules/performance', () => ({
  parallelProcess: jest.fn().mockResolvedValue([]),
  streamReadFile: jest.fn().mockResolvedValue('test content'),
  cacheFile: jest.fn(),
  getCachedFile: jest.fn().mockReturnValue(null),
  clearMemoryCache: jest.fn(),
  tempFileManager: {
    registerTempFile: jest.fn()
  }
}));

jest.mock('js-beautify', () => ({
  js: jest.fn().mockReturnValue('beautified js'),
  css: jest.fn().mockReturnValue('beautified css'),
  html: jest.fn().mockReturnValue('beautified html')
}));

describe('Decompiler', () => {
  let decompiler;
  const tempDir = path.join(__dirname, 'temp');
  const outputDir = path.join(__dirname, 'output');

  beforeEach(() => {
    decompiler = new Decompiler();
    jest.clearAllMocks();
  });

  describe('_isCodeFile', () => {
    test('should return true for js files', () => {
      const result = decompiler._isCodeFile('test.js');
      expect(result).toBe(true);
    });

    test('should return true for css files', () => {
      const result = decompiler._isCodeFile('test.css');
      expect(result).toBe(true);
    });

    test('should return true for html files', () => {
      const result = decompiler._isCodeFile('test.html');
      expect(result).toBe(true);
    });

    test('should return false for other files', () => {
      const result = decompiler._isCodeFile('test.txt');
      expect(result).toBe(false);
    });
  });

  describe('beautifyJS', () => {
    test('should beautify js code', () => {
      const code = 'function test(){return 1;}';
      const result = decompiler.beautifyJS(code);
      expect(result).toBe('beautified js');
    });
  });

  describe('beautifyCSS', () => {
    test('should beautify css code', () => {
      const code = 'body{margin:0;}';
      const result = decompiler.beautifyCSS(code);
      expect(result).toBe('beautified css');
    });
  });

  describe('beautifyHTML', () => {
    test('should beautify html code', () => {
      const code = '<div><p>test</p></div>';
      const result = decompiler.beautifyHTML(code);
      expect(result).toBe('beautified html');
    });
  });

  describe('scanFrontendFiles', () => {
    test('should scan frontend files', async () => {
      const fs = require('fs-extra');
      fs.readdir.mockResolvedValue([]);

      const result = await decompiler.scanFrontendFiles(tempDir);
      expect(result).toHaveProperty('html');
      expect(result).toHaveProperty('css');
      expect(result).toHaveProperty('js');
      expect(result).toHaveProperty('images');
      expect(result).toHaveProperty('fonts');
      expect(result).toHaveProperty('config');
      expect(result).toHaveProperty('other');
    });
  });

  describe('decompileFile', () => {
    test('should decompile js file', async () => {
      const result = await decompiler.decompileFile('test.js');
      expect(result).toBe('beautified js');
    });

    test('should decompile css file', async () => {
      const result = await decompiler.decompileFile('test.css');
      expect(result).toBe('beautified css');
    });

    test('should decompile html file', async () => {
      const result = await decompiler.decompileFile('test.html');
      expect(result).toBe('beautified html');
    });

    test('should return original content for other files', async () => {
      const result = await decompiler.decompileFile('test.txt');
      expect(result).toBe('test content');
    });

    test('should handle cached content', async () => {
      const performance = require('../src/modules/performance');
      performance.getCachedFile.mockReturnValue('cached content');

      const result = await decompiler.decompileFile('test.js');
      expect(result).toBe('cached content');
    });

    test('should handle decompile error', async () => {
      const performance = require('../src/modules/performance');
      performance.getCachedFile.mockReturnValue(null);
      performance.streamReadFile.mockRejectedValue(new Error('Read error'));

      const platform = require('../src/modules/platform');
      platform.readFile.mockResolvedValue('fallback content');

      const result = await decompiler.decompileFile('test.js');
      expect(result).toBe('fallback content');
    });

    test('should return empty string on complete failure', async () => {
      const performance = require('../src/modules/performance');
      performance.getCachedFile.mockReturnValue(null);
      performance.streamReadFile.mockRejectedValue(new Error('Read error'));

      const platform = require('../src/modules/platform');
      platform.readFile.mockRejectedValue(new Error('Fallback error'));

      const result = await decompiler.decompileFile('test.js');
      expect(result).toBe('');
    });
  });

  describe('detectFramework', () => {
    test('should detect vue framework from package.json', async () => {
      const platform = require('../src/modules/platform');
      platform.fileExists.mockReturnValue(true);

      const fs = require('fs-extra');
      fs.readJson.mockResolvedValue({ dependencies: { vue: '3.0.0' } });

      const result = await decompiler.detectFramework(tempDir);
      expect(result).toBe('vue');
    });

    test('should detect react framework from package.json', async () => {
      const platform = require('../src/modules/platform');
      platform.fileExists.mockReturnValue(true);

      const fs = require('fs-extra');
      fs.readJson.mockResolvedValue({ dependencies: { react: '18.0.0' } });

      const result = await decompiler.detectFramework(tempDir);
      expect(result).toBe('react');
    });

    test('should detect angular framework from package.json', async () => {
      const platform = require('../src/modules/platform');
      platform.fileExists.mockReturnValue(true);

      const fs = require('fs-extra');
      fs.readJson.mockResolvedValue({ dependencies: { angular: '15.0.0' } });

      const result = await decompiler.detectFramework(tempDir);
      expect(result).toBe('angular');
    });

    test('should detect vue from file content', async () => {
      const platform = require('../src/modules/platform');
      platform.fileExists.mockReturnValue(false);

      const fs = require('fs-extra');
      // Mock scanFrontendFiles to return js files
      jest.spyOn(decompiler, 'scanFrontendFiles').mockResolvedValue({
        html: [],
        css: [],
        js: ['test.js'],
        images: [],
        fonts: [],
        config: [],
        other: []
      });
      fs.readFile.mockResolvedValue('import Vue from \'vue\'');

      const result = await decompiler.detectFramework(tempDir);
      expect(result).toBe('vue');
    });

    test('should detect react from file content', async () => {
      const platform = require('../src/modules/platform');
      platform.fileExists.mockReturnValue(false);

      const fs = require('fs-extra');
      // Mock scanFrontendFiles to return js files
      jest.spyOn(decompiler, 'scanFrontendFiles').mockResolvedValue({
        html: [],
        css: [],
        js: ['test.js'],
        images: [],
        fonts: [],
        config: [],
        other: []
      });
      fs.readFile.mockResolvedValue('import React from \'react\'');

      const result = await decompiler.detectFramework(tempDir);
      expect(result).toBe('react');
    });

    test('should return unknown for unknown framework', async () => {
      const platform = require('../src/modules/platform');
      platform.fileExists.mockReturnValue(false);

      const fs = require('fs-extra');
      fs.readdir.mockResolvedValue([]);

      const result = await decompiler.detectFramework(tempDir);
      expect(result).toBe('unknown');
    });
  });

  describe('generateEntryFile', () => {
    test('should generate default entry file', async () => {
      const fs = require('fs-extra');
      
      const result = await decompiler.generateEntryFile(outputDir, 'unknown');
      expect(fs.writeFile).toHaveBeenCalled();
      expect(result).toContain('index.html');
    });

    test('should generate vue entry file', async () => {
      const fs = require('fs-extra');
      
      const result = await decompiler.generateEntryFile(outputDir, 'vue');
      expect(fs.writeFile).toHaveBeenCalled();
      expect(result).toContain('index.html');
    });

    test('should generate react entry file', async () => {
      const fs = require('fs-extra');
      
      const result = await decompiler.generateEntryFile(outputDir, 'react');
      expect(fs.writeFile).toHaveBeenCalled();
      expect(result).toContain('index.html');
    });
  });

  describe('reorganizeResources', () => {
    test('should reorganize resources successfully', async () => {
      const fs = require('fs-extra');
      fs.readdir.mockResolvedValue([]);

      const platform = require('../src/modules/platform');
      platform.fileExists.mockReturnValue(false);

      const result = await decompiler.reorganizeResources(tempDir, outputDir);
      expect(result.success).toBe(true);
      expect(result.framework).toBe('unknown');
      expect(result.files).toBe(0);
    });

    test('should handle reorganization error', async () => {
      // Mock scanFrontendFiles to throw error
      jest.spyOn(decompiler, 'scanFrontendFiles').mockRejectedValue(new Error('Scan error'));

      await expect(decompiler.reorganizeResources(tempDir, outputDir)).rejects.toThrow('重组资源失败');
    });
  });

  describe('_copyFiles', () => {
    test('should copy files', async () => {
      const files = ['file1.js', 'file2.css'];
      
      await decompiler._copyFiles(files, outputDir);
      
      const performance = require('../src/modules/performance');
      expect(performance.parallelProcess).toHaveBeenCalled();
    });
  });

  describe('_scanDirectory', () => {
    test('should scan directory', async () => {
      const fs = require('fs-extra');
      // 返回一个包含文件条目的数组，模拟目录中有文件
      fs.readdir.mockResolvedValue([
        { name: 'test.html', isDirectory: () => false, isFile: () => true },
        { name: 'test.css', isDirectory: () => false, isFile: () => true }
      ]);

      const files = { html: [], css: [], js: [], images: [], fonts: [], config: [], other: [] };
      await decompiler._scanDirectory(tempDir, files);

      const performance = require('../src/modules/performance');
      expect(performance.parallelProcess).toHaveBeenCalled();
    });

    test('should handle scan error', async () => {
      const fs = require('fs-extra');
      fs.readdir.mockRejectedValue(new Error('Read error'));

      const files = { html: [], css: [], js: [], images: [], fonts: [], config: [], other: [] };
      await expect(decompiler._scanDirectory(tempDir, files)).resolves.not.toThrow();
    });
  });
});
