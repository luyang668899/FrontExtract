const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  selectFile: () => ipcRenderer.invoke('select-file'),
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  parseFile: (filePath, outputPath) => ipcRenderer.invoke('parse-file', filePath, outputPath),
  openOutputDir: (outputPath) => ipcRenderer.invoke('open-output-dir', outputPath),
  detectPermissions: (targetPath) => ipcRenderer.invoke('detect-permissions', targetPath),
  validateAndCreatePath: (targetPath) => ipcRenderer.invoke('validate-and-create-path', targetPath),
  getRecommendedPath: () => ipcRenderer.invoke('get-recommended-path'),
  detectDiskStatus: (dirPath) => ipcRenderer.invoke('detect-disk-status', dirPath),
  onProgress: (callback) => ipcRenderer.on('progress', (event, data) => callback(data))
});