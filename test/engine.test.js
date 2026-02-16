const path = require('path');
const Engine = require('../src/modules/engine');

// 简化mock设置
jest.mock('../src/modules/unpacker', () => {
  const mockUnpacker = {
    unpack: jest.fn().mockResolvedValue('/tmp/unpacked'),
    detectFormat: jest.fn().mockReturnValue('zip'),
    supportedFormats: {
      zip: ['.zip', '.asar'],
      electron: ['.exe', '.dmg', '.deb', '.rpm'],
      other: ['.7z', '.rar']
    }
  };
  return jest.fn(() => mockUnpacker);
});

jest.mock('../src/modules/decompiler', () => {
  const mockDecompiler = {
    scanFrontendFiles: jest.fn().mockResolvedValue({ html: [], css: [], js: [] }),
    reorganizeResources: jest.fn().mockResolvedValue({ success: true, framework: 'vue', files: 0 }),
    detectFramework: jest.fn().mockResolvedValue('vue')
  };
  return jest.fn(() => mockDecompiler);
});

jest.mock('../src/modules/packer', () => {
  const mockPacker = {
    generateFrontendPackage: jest.fn().mockResolvedValue('/tmp/output'),
    validateFrontendPackage: jest.fn().mockResolvedValue({ success: true }),
    getPackageInfo: jest.fn().mockResolvedValue({ success: true, info: {} })
  };
  return jest.fn(() => mockPacker);
});

jest.mock('../src/modules/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
}));

jest.mock('../src/modules/resourceMonitor', () => ({
  checkSystemResources: jest.fn().mockResolvedValue({ hasEnoughResources: true }),
  startMonitoring: jest.fn(),
  stopMonitoring: jest.fn()
}));

jest.mock('../src/modules/performance', () => ({
  clearMemoryCache: jest.fn(),
  tempFileManager: {
    registerTempFile: jest.fn()
  }
}));

jest.mock('../src/modules/platform', () => ({
  joinPath: jest.fn((...args) => args.join('/')),
  remove: jest.fn().mockResolvedValue(true),
  createDir: jest.fn().mockResolvedValue(true),
  getTempDir: jest.fn().mockReturnValue('/tmp'),
  fileExists: jest.fn().mockReturnValue(true),
  evaluateOutputPath: jest.fn().mockReturnValue({
    warnings: [],
    recommendedPath: '/mock/recommended/path'
  })
}));

jest.mock('../src/modules/resourceMonitor', () => ({
  checkSystemResources: jest.fn().mockResolvedValue({ hasEnoughResources: true }),
  startMonitoring: jest.fn(),
  stopMonitoring: jest.fn()
}));

jest.mock('fs-extra', () => ({
  stat: jest.fn().mockResolvedValue({ size: 1024 }),
  ensureDir: jest.fn().mockResolvedValue(true)
}));

describe('Engine', () => {
  let engine;
  const tempDir = path.join(__dirname, 'temp');
  const outputPath = path.join(__dirname, 'output');
  const testFilePath = path.join(__dirname, 'test.zip');

  beforeEach(() => {
    engine = new Engine();
    jest.clearAllMocks();
  });

  describe('isSupported', () => {
    test('should return true for supported format', () => {
      const result = engine.isSupported('test.zip');
      expect(result).toBe(true);
    });

    test('should return false for unsupported format', () => {
      engine.unpacker.detectFormat.mockReturnValue('unknown');
      const result = engine.isSupported('test.txt');
      expect(result).toBe(false);
    });
  });

  describe('getSupportedFormats', () => {
    test('should get supported formats', () => {
      const result = engine.getSupportedFormats();
      expect(result).toHaveProperty('zip');
      expect(result).toHaveProperty('electron');
      expect(result).toHaveProperty('other');
    });
  });

  describe('parsePackage', () => {
    test('should successfully parse package with normal flow', async () => {
      const onProgress = jest.fn();
      
      // Mock dependencies
      engine.unpacker.unpack.mockResolvedValue();
      engine.decompiler.scanFrontendFiles.mockResolvedValue({
        html: ['file1.html'],
        css: ['file1.css'],
        js: ['file1.js']
      });
      engine.decompiler.reorganizeResources.mockResolvedValue({
        success: true,
        framework: 'vue',
        files: 3
      });
      engine.packer.generateFrontendPackage.mockResolvedValue(outputPath);
      engine.packer.validateFrontendPackage.mockResolvedValue({ success: true });
      engine.packer.getPackageInfo.mockResolvedValue({ success: true, info: { name: 'test' } });

      const result = await engine.parsePackage(testFilePath, outputPath, {
        format: 'folder',
        onProgress
      });

      expect(result.success).toBe(true);
      expect(result.message).toBe('前端资源提取成功');
      expect(result.outputPath).toBe(outputPath);
      expect(result.framework).toBe('vue');
      expect(result.fileCount).toBe(3);
      expect(onProgress).toHaveBeenCalled();
    });

    test('should handle large file processing', async () => {
      const onProgress = jest.fn();
      
      // Mock large file
      const fs = require('fs-extra');
      fs.stat.mockResolvedValue({ size: 200 * 1024 * 1024 }); // 200MB

      // Mock dependencies
      engine.unpacker.unpack.mockResolvedValue();
      engine.decompiler.scanFrontendFiles.mockResolvedValue({ html: [], css: [], js: [] });
      engine.decompiler.reorganizeResources.mockResolvedValue({ success: true, framework: 'react', files: 0 });
      engine.packer.generateFrontendPackage.mockResolvedValue(outputPath);
      engine.packer.validateFrontendPackage.mockResolvedValue({ success: true });
      engine.packer.getPackageInfo.mockResolvedValue({ success: true, info: {} });

      const result = await engine.parsePackage(testFilePath, outputPath, {
        format: 'folder',
        onProgress
      });

      expect(result.success).toBe(true);
    });

    test('should throw error when system resources are insufficient', async () => {
      const onProgress = jest.fn();
      
      // Mock insufficient resources
      const resourceMonitor = require('../src/modules/resourceMonitor');
      resourceMonitor.checkSystemResources.mockResolvedValue({
        hasEnoughResources: false,
        alerts: [{ message: '内存不足' }]
      });

      await expect(engine.parsePackage(testFilePath, outputPath, {
        format: 'folder',
        onProgress
      })).rejects.toThrow('系统资源不足，无法处理该文件。请关闭其他应用后重试。');
    });

    test('should throw error when validation fails', async () => {
      // Ensure resource check passes
      const resourceMonitor = require('../src/modules/resourceMonitor');
      resourceMonitor.checkSystemResources.mockResolvedValue({ hasEnoughResources: true });
      
      // Mock validation failure
      engine.unpacker.unpack.mockResolvedValue();
      engine.decompiler.scanFrontendFiles.mockResolvedValue({ html: [], css: [], js: [] });
      engine.decompiler.reorganizeResources.mockResolvedValue({ success: true, framework: 'vue', files: 0 });
      engine.packer.generateFrontendPackage.mockResolvedValue(outputPath);
      engine.packer.validateFrontendPackage.mockResolvedValue({ 
        success: false, 
        message: '验证失败' 
      });

      await expect(engine.parsePackage(testFilePath, outputPath, {
        format: 'folder'
      })).rejects.toThrow('前端包验证失败: 验证失败');
    });

    test('should handle unpacking failure', async () => {
      // Ensure resource check passes
      const resourceMonitor = require('../src/modules/resourceMonitor');
      resourceMonitor.checkSystemResources.mockResolvedValue({ hasEnoughResources: true });
      
      // Mock unpacking failure
      engine.unpacker.unpack.mockRejectedValue(new Error('解包失败'));

      await expect(engine.parsePackage(testFilePath, outputPath, {
        format: 'folder'
      })).rejects.toThrow('解包失败');
    });

    test('should handle reorganization failure', async () => {
      // Ensure resource check passes
      const resourceMonitor = require('../src/modules/resourceMonitor');
      resourceMonitor.checkSystemResources.mockResolvedValue({ hasEnoughResources: true });
      
      // Mock reorganization failure
      engine.unpacker.unpack.mockResolvedValue();
      engine.decompiler.scanFrontendFiles.mockResolvedValue({ html: [], css: [], js: [] });
      engine.decompiler.reorganizeResources.mockRejectedValue(new Error('重组失败'));

      await expect(engine.parsePackage(testFilePath, outputPath, {
        format: 'folder'
      })).rejects.toThrow('重组失败');
    });

    test('should handle packaging failure', async () => {
      // Ensure resource check passes
      const resourceMonitor = require('../src/modules/resourceMonitor');
      resourceMonitor.checkSystemResources.mockResolvedValue({ hasEnoughResources: true });
      
      // Mock packaging failure
      engine.unpacker.unpack.mockResolvedValue();
      engine.decompiler.scanFrontendFiles.mockResolvedValue({ html: [], css: [], js: [] });
      engine.decompiler.reorganizeResources.mockResolvedValue({ success: true, framework: 'vue', files: 0 });
      engine.packer.generateFrontendPackage.mockRejectedValue(new Error('打包失败'));

      await expect(engine.parsePackage(testFilePath, outputPath, {
        format: 'folder'
      })).rejects.toThrow('打包失败');
    });
  });

  describe('_initTempDir', () => {
    test('should initialize temporary directory', async () => {
      // Access private method for testing
      await engine._initTempDir();
      
      const platform = require('../src/modules/platform');
      expect(platform.createDir).toHaveBeenCalled();
    });
  });

  describe('_cleanupTempDir', () => {
    test('should cleanup temporary directory', async () => {
      // Access private method for testing
      await engine._cleanupTempDir();
      
      const platform = require('../src/modules/platform');
      expect(platform.remove).toHaveBeenCalled();
    });

    test('should handle cleanup errors gracefully', async () => {
      // Mock cleanup error
      const platform = require('../src/modules/platform');
      platform.remove.mockRejectedValue(new Error('清理失败'));
      
      // Should not throw
      await expect(engine._cleanupTempDir()).resolves.not.toThrow();
    });
  });
});
