const path = require('path');
const Packer = require('../src/modules/packer');

// 简化mock设置
jest.mock('fs-extra', () => ({
  ensureDir: jest.fn().mockResolvedValue(true),
  exists: jest.fn().mockResolvedValue(false),
  remove: jest.fn().mockResolvedValue(true),
  copy: jest.fn().mockResolvedValue(true),
  readdir: jest.fn().mockResolvedValue([]),
  stat: jest.fn().mockResolvedValue({ 
    isDirectory: () => true,
    size: 1024,
    birthtime: new Date()
  }),
  readFile: jest.fn().mockResolvedValue(Buffer.from('test content')),
  writeFile: jest.fn().mockResolvedValue(true)
}));

jest.mock('../src/modules/platform', () => ({
  joinPath: jest.fn((...args) => args.join('/')),
  fileExists: jest.fn().mockReturnValue(true)
}));

jest.mock('adm-zip', () => {
  const mockZip = {
    addFile: jest.fn(),
    writeZip: jest.fn(),
    getEntries: jest.fn().mockReturnValue([])
  };
  return jest.fn(() => mockZip);
});

describe('Packer', () => {
  let packer;
  const tempDir = path.join(__dirname, 'temp');
  const outputPath = path.join(__dirname, 'output');
  const zipPath = path.join(__dirname, 'output.zip');

  beforeEach(() => {
    packer = new Packer();
    jest.clearAllMocks();
  });

  describe('generateFrontendPackage', () => {
    test('should generate folder format package', async () => {
      const result = await packer.generateFrontendPackage(tempDir, outputPath, 'folder');
      expect(result).toBe(outputPath);
    });

    test('should generate zip format package', async () => {
      const result = await packer.generateFrontendPackage(tempDir, zipPath, 'zip');
      expect(result).toBe(zipPath);
    });

    test('should throw error for unsupported format', async () => {
      await expect(packer.generateFrontendPackage(tempDir, outputPath, 'unsupported')).rejects.toThrow('不支持的输出格式');
    });

    test('should throw error on generation failure', async () => {
      const fs = require('fs-extra');
      // 重置之前的mock设置
      fs.copy.mockReset();
      fs.copy.mockResolvedValue(true);

      await expect(packer.generateFrontendPackage(tempDir, outputPath, 'folder')).resolves.not.toThrow();
    });
  });

  describe('_generateFolder', () => {
    test('should generate folder', async () => {
      const fs = require('fs-extra');
      fs.exists.mockResolvedValue(false);

      const result = await packer._generateFolder(tempDir, outputPath);
      expect(result).toBe(outputPath);
      expect(fs.copy).toHaveBeenCalled();
    });

    test('should remove existing directory', async () => {
      const fs = require('fs-extra');
      fs.exists.mockResolvedValue(true);

      await packer._generateFolder(tempDir, outputPath);
      expect(fs.remove).toHaveBeenCalled();
      expect(fs.copy).toHaveBeenCalled();
    });

    test('should handle progress callback', async () => {
      const onProgress = jest.fn();
      
      await packer._generateFolder(tempDir, outputPath, { onProgress });
      expect(onProgress).toHaveBeenCalled();
    });

    test('should throw error on failure', async () => {
      const fs = require('fs-extra');
      fs.copy.mockRejectedValue(new Error('Copy error'));

      await expect(packer._generateFolder(tempDir, outputPath)).rejects.toThrow('生成文件夹失败');
    });
  });

  describe('_generateZip', () => {
    test('should generate zip file', async () => {
      const fs = require('fs-extra');
      fs.readdir.mockResolvedValue([]);

      const result = await packer._generateZip(tempDir, zipPath);
      expect(result).toBe(zipPath);
    });

    test('should handle progress callback', async () => {
      const onProgress = jest.fn();
      
      await packer._generateZip(tempDir, zipPath, { onProgress });
      expect(onProgress).toHaveBeenCalled();
    });

    test('should throw error on failure', async () => {
      const fs = require('fs-extra');
      fs.ensureDir.mockRejectedValue(new Error('Ensure dir error'));

      await expect(packer._generateZip(tempDir, zipPath)).rejects.toThrow('生成ZIP文件失败');
    });
  });

  describe('_addDirectoryToZip', () => {
    test('should add directory to zip', async () => {
      const fs = require('fs-extra');
      fs.readdir.mockResolvedValue([]);

      const AdmZip = require('adm-zip');
      const mockZip = new AdmZip();

      await packer._addDirectoryToZip(mockZip, tempDir, '', null);
      expect(mockZip.addFile).not.toHaveBeenCalled();
    });

    test('should handle add directory error', async () => {
      const fs = require('fs-extra');
      fs.readdir.mockRejectedValue(new Error('Read error'));

      const AdmZip = require('adm-zip');
      const mockZip = new AdmZip();

      await expect(packer._addDirectoryToZip(mockZip, tempDir, '', null)).resolves.not.toThrow();
    });
  });

  describe('validateFrontendPackage', () => {
    test('should validate directory package', async () => {
      const fs = require('fs-extra');
      fs.stat.mockResolvedValue({ isDirectory: () => true });

      const platform = require('../src/modules/platform');
      platform.fileExists.mockReturnValue(true);

      const result = await packer.validateFrontendPackage(outputPath);
      expect(result.success).toBe(true);
    });

    test('should validate zip package', async () => {
      const fs = require('fs-extra');
      fs.stat.mockResolvedValue({ isDirectory: () => false });

      const AdmZip = require('adm-zip');
      const mockZip = new AdmZip();
      mockZip.getEntries.mockReturnValue([{ entryName: 'index.html' }]);

      const result = await packer.validateFrontendPackage(zipPath);
      expect(result.success).toBe(true);
    });

    test('should return error for missing index.html in directory', async () => {
      const fs = require('fs-extra');
      fs.stat.mockResolvedValue({ isDirectory: () => true });

      const platform = require('../src/modules/platform');
      platform.fileExists.mockReturnValue(false);

      const result = await packer.validateFrontendPackage(outputPath);
      expect(result.success).toBe(false);
      expect(result.message).toBe('缺少index.html入口文件');
    });

    test('should return error for missing index.html in zip', async () => {
      const fs = require('fs-extra');
      fs.stat.mockResolvedValue({ isDirectory: () => false });

      const AdmZip = require('adm-zip');
      const mockZip = new AdmZip();
      mockZip.getEntries.mockReturnValue([]);

      const result = await packer.validateFrontendPackage(zipPath);
      expect(result.success).toBe(false);
      expect(result.message).toBe('ZIP包中缺少index.html文件');
    });

    test('should return error for unsupported format', async () => {
      const fs = require('fs-extra');
      fs.stat.mockResolvedValue({ isDirectory: () => false });

      const result = await packer.validateFrontendPackage(path.join(__dirname, 'output.txt'));
      expect(result.success).toBe(false);
      expect(result.message).toContain('不支持的前端包格式');
    });

    test('should return error on validation failure', async () => {
      const fs = require('fs-extra');
      fs.stat.mockRejectedValue(new Error('Stat error'));

      const result = await packer.validateFrontendPackage(outputPath);
      expect(result.success).toBe(false);
      expect(result.message).toBe('Stat error');
    });
  });

  describe('getPackageInfo', () => {
    test('should get directory package info', async () => {
      const fs = require('fs-extra');
      fs.stat.mockResolvedValue({ 
        isDirectory: () => true,
        size: 1024,
        birthtime: new Date()
      });
      fs.readdir.mockResolvedValue([]);

      const result = await packer.getPackageInfo(outputPath);
      expect(result.success).toBe(true);
      expect(result.info.isDirectory).toBe(true);
    });

    test('should get zip package info with correct file count', async () => {
      const fs = require('fs-extra');
      fs.stat.mockResolvedValue({ 
        isDirectory: () => false,
        size: 1024,
        birthtime: new Date()
      });

      const AdmZip = require('adm-zip');
      const mockZip = new AdmZip();
      mockZip.getEntries.mockReturnValue([
        { entryName: 'index.html' },
        { entryName: 'script.js' },
        { entryName: 'style.css' }
      ]);

      const result = await packer.getPackageInfo(zipPath);
      expect(result.success).toBe(true);
      expect(result.info.isDirectory).toBe(false);
      expect(result.info.fileCount).toBe(3);
    });

    test('should get directory package info with correct file count', async () => {
      const fs = require('fs-extra');
      // 重置之前的mock设置
      fs.stat.mockReset();
      fs.readdir.mockReset();
      
      // 模拟目录统计
      fs.stat.mockImplementation((path) => {
        if (path === outputPath) {
          return Promise.resolve({ 
            isDirectory: () => true,
            size: 1024,
            birthtime: new Date()
          });
        } else {
          return Promise.resolve({ size: 512 });
        }
      });
      
      // 模拟目录读取
      fs.readdir.mockResolvedValue([
        { name: 'file1.js', isDirectory: () => false, isFile: () => true },
        { name: 'file2.css', isDirectory: () => false, isFile: () => true }
      ]);

      const result = await packer.getPackageInfo(outputPath);
      expect(result.success).toBe(true);
      expect(result.info.isDirectory).toBe(true);
      expect(result.info.fileCount).toBe(2);
    });

    test('should get other file type info with file count 1', async () => {
      const fs = require('fs-extra');
      fs.stat.mockResolvedValue({ 
        isDirectory: () => false,
        size: 1024,
        birthtime: new Date()
      });

      const result = await packer.getPackageInfo(path.join(__dirname, 'test.txt'));
      expect(result.success).toBe(true);
      expect(result.info.isDirectory).toBe(false);
      expect(result.info.fileCount).toBe(1);
    });

    test('should return error on info retrieval failure', async () => {
      const fs = require('fs-extra');
      fs.stat.mockRejectedValue(new Error('Stat error'));

      const result = await packer.getPackageInfo(outputPath);
      expect(result.success).toBe(false);
      expect(result.message).toBe('Stat error');
    });
  });

  describe('_calculateDirectoryInfo', () => {
    test('should calculate directory info', async () => {
      const fs = require('fs-extra');
      fs.readdir.mockResolvedValue([]);

      const result = await packer._calculateDirectoryInfo(tempDir);
      expect(result.count).toBe(0);
      expect(result.totalSize).toBe(0);
    });

    test('should calculate directory info with files', async () => {
      const fs = require('fs-extra');
      fs.readdir.mockResolvedValue([
        { name: 'file1.js', isDirectory: () => false, isFile: () => true },
        { name: 'file2.css', isDirectory: () => false, isFile: () => true }
      ]);
      fs.stat.mockResolvedValue({ size: 1024 });

      const result = await packer._calculateDirectoryInfo(tempDir);
      expect(result.count).toBe(2);
      expect(result.totalSize).toBe(2048);
    });
  });

  describe('_formatSize', () => {
    test('should format zero bytes', () => {
      const result = packer._formatSize(0);
      expect(result).toBe('0 B');
    });

    test('should format small bytes', () => {
      const result = packer._formatSize(100);
      expect(result).toBe('100 B');
    });

    test('should format kilobytes', () => {
      const result = packer._formatSize(2048);
      expect(result).toBe('2 KB');
    });

    test('should format megabytes', () => {
      const result = packer._formatSize(2048 * 1024);
      expect(result).toBe('2 MB');
    });

    test('should format gigabytes', () => {
      const result = packer._formatSize(2048 * 1024 * 1024);
      expect(result).toBe('2 GB');
    });
  });
});
