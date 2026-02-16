const path = require('path');
const fs = require('fs-extra');
const Unpacker = require('../src/modules/unpacker');
const platform = require('../src/modules/platform');

jest.mock('child_process', () => ({
  execSync: jest.fn(),
  exec: jest.fn()
}));

jest.mock('fs-extra', () => ({
  ensureDir: jest.fn().mockResolvedValue(true),
  readdir: jest.fn().mockResolvedValue(['test-file.txt']),
  stat: jest.fn().mockResolvedValue({ isDirectory: () => false }),
  copy: jest.fn().mockResolvedValue(true),
  remove: jest.fn().mockResolvedValue(true),
  exists: jest.fn().mockResolvedValue(false),
  writeFile: jest.fn().mockResolvedValue(true),
  readFile: jest.fn().mockResolvedValue('test content')
}));

jest.mock('../src/modules/platform', () => ({
  isMac: true,
  isLinux: false,
  getTempDir: jest.fn().mockReturnValue('/tmp'),
  joinPath: jest.fn((...args) => args.join('/')),
  fileExists: jest.fn().mockReturnValue(true),
  remove: jest.fn().mockResolvedValue(true),
  createDir: jest.fn().mockResolvedValue(true),
  readFile: jest.fn().mockResolvedValue('test content'),
  writeFile: jest.fn().mockResolvedValue(true),
  copy: jest.fn().mockResolvedValue(true),
  getPathSeparator: jest.fn().mockReturnValue('/')
}));

jest.mock('adm-zip', () => {
  const mockZip = {
    getEntries: jest.fn().mockReturnValue([]),
    extractEntryTo: jest.fn(),
    extractAllTo: jest.fn(),
    addFile: jest.fn(),
    writeZip: jest.fn()
  };
  return jest.fn(() => mockZip);
});

jest.mock('extract-zip', () => jest.fn().mockResolvedValue(true));

describe('Unpacker', () => {
  let unpacker;
  const tempDir = path.join(__dirname, 'temp');

  beforeEach(() => {
    unpacker = new Unpacker();
    jest.clearAllMocks();
  });

  describe('detectFormat', () => {
    test('should detect zip format', () => {
      const result = unpacker.detectFormat('test.zip');
      expect(result).toBe('zip');
    });

    test('should detect electron format for exe', () => {
      const result = unpacker.detectFormat('test.exe');
      expect(result).toBe('electron');
    });

    test('should detect electron format for dmg', () => {
      const result = unpacker.detectFormat('test.dmg');
      expect(result).toBe('electron');
    });

    test('should detect electron format for deb', () => {
      const result = unpacker.detectFormat('test.deb');
      expect(result).toBe('electron');
    });

    test('should detect electron format for rpm', () => {
      const result = unpacker.detectFormat('test.rpm');
      expect(result).toBe('electron');
    });

    test('should return unknown for unsupported format', () => {
      const result = unpacker.detectFormat('test.txt');
      expect(result).toBe('unknown');
    });
  });

  describe('unpack', () => {
    test('should unpack zip file', async () => {
      const mockUnpackZip = jest.spyOn(unpacker, 'unpackZip').mockResolvedValue(tempDir);
      const result = await unpacker.unpack('test.zip', tempDir);
      expect(mockUnpackZip).toHaveBeenCalledWith('test.zip', tempDir, { isLargeFile: false, onProgress: undefined });
      expect(result).toBe(tempDir);
    });

    test('should unpack electron file', async () => {
      const mockUnpackElectron = jest.spyOn(unpacker, 'unpackElectron').mockResolvedValue(tempDir);
      const result = await unpacker.unpack('test.exe', tempDir);
      expect(mockUnpackElectron).toHaveBeenCalledWith('test.exe', tempDir, { isLargeFile: false, onProgress: undefined });
      expect(result).toBe(tempDir);
    });

    test('should throw error for unsupported format', async () => {
      await expect(unpacker.unpack('test.txt', tempDir)).rejects.toThrow('不支持的文件格式: .txt');
    });
  });

  describe('unpackZip', () => {
    test('should unpack regular zip file', async () => {
      const result = await unpacker.unpackZip('test.zip', tempDir);
      expect(result).toBe(tempDir);
    });

    test('should unpack asar file', async () => {
      const mockUnpackAsar = jest.spyOn(unpacker, 'unpackAsar').mockResolvedValue(tempDir);
      const result = await unpacker.unpackZip('test.asar', tempDir);
      expect(mockUnpackAsar).toHaveBeenCalledWith('test.asar', tempDir, { isLargeFile: false, onProgress: undefined });
      expect(result).toBe(tempDir);
    });
  });

  describe('unpackAsar', () => {
    test('should unpack asar file', async () => {
      const result = await unpacker.unpackAsar('test.asar', tempDir);
      expect(result).toBe(tempDir);
    });
  });

  describe('unpackElectron', () => {
    test('should unpack windows exe', async () => {
      const mockUnpackWindowsExe = jest.spyOn(unpacker, 'unpackWindowsExe').mockResolvedValue(tempDir);
      const result = await unpacker.unpackElectron('test.exe', tempDir);
      expect(mockUnpackWindowsExe).toHaveBeenCalledWith('test.exe', tempDir);
      expect(result).toBe(tempDir);
    });

    test('should unpack dmg file', async () => {
      const mockUnpackDmg = jest.spyOn(unpacker, 'unpackDmg').mockResolvedValue(tempDir);
      const result = await unpacker.unpackElectron('test.dmg', tempDir);
      expect(mockUnpackDmg).toHaveBeenCalledWith('test.dmg', tempDir);
      expect(result).toBe(tempDir);
    });

    test('should unpack deb file', async () => {
      const mockUnpackLinuxPackage = jest.spyOn(unpacker, 'unpackLinuxPackage').mockResolvedValue(tempDir);
      const result = await unpacker.unpackElectron('test.deb', tempDir);
      expect(mockUnpackLinuxPackage).toHaveBeenCalledWith('test.deb', tempDir);
      expect(result).toBe(tempDir);
    });

    test('should unpack rpm file', async () => {
      const mockUnpackLinuxPackage = jest.spyOn(unpacker, 'unpackLinuxPackage').mockResolvedValue(tempDir);
      const result = await unpacker.unpackElectron('test.rpm', tempDir);
      expect(mockUnpackLinuxPackage).toHaveBeenCalledWith('test.rpm', tempDir);
      expect(result).toBe(tempDir);
    });

    test('should throw error for unsupported electron format', async () => {
      await expect(unpacker.unpackElectron('test.unknown', tempDir)).rejects.toThrow('不支持的Electron包格式: .unknown');
    });
  });

  describe('unpackWindowsExe', () => {
    test('should unpack windows exe', async () => {
      const result = await unpacker.unpackWindowsExe('test.exe', tempDir);
      expect(result).toBe(tempDir);
    });
  });

  describe('unpackDmg', () => {
    test('should unpack dmg file on mac', async () => {
      const result = await unpacker.unpackDmg('test.dmg', tempDir);
      expect(result).toBe(tempDir);
    });

    test('should throw error on non-mac platform', async () => {
      platform.isMac = false;
      await expect(unpacker.unpackDmg('test.dmg', tempDir)).rejects.toThrow('DMG文件解包仅在macOS平台上支持');
      platform.isMac = true;
    });
  });

  describe('unpackLinuxPackage', () => {
    test('should unpack deb file on linux or mac', async () => {
      const result = await unpacker.unpackLinuxPackage('test.deb', tempDir);
      expect(result).toBe(tempDir);
    });

    test('should unpack rpm file on linux or mac', async () => {
      const result = await unpacker.unpackLinuxPackage('test.rpm', tempDir);
      expect(result).toBe(tempDir);
    });

    test('should throw error for unsupported linux format', async () => {
      await expect(unpacker.unpackLinuxPackage('test.unknown', tempDir)).rejects.toThrow('不支持的Linux包格式: .unknown');
    });
  });

  describe('cleanup', () => {
    test('should cleanup temp directory', async () => {
      await unpacker.cleanup(tempDir);
      expect(platform.remove).toHaveBeenCalledWith(tempDir);
    });
  });
});
