/**
 * 模块入口文件
 * 导出所有核心模块，方便其他文件引用
 */

// 核心功能模块
const Engine = require('./engine');
const Unpacker = require('./unpacker');
const Decompiler = require('./decompiler');
const Packer = require('./packer');

// 工具模块
const platform = require('./platform');
const logger = require('./logger');
const errorHandler = require('./errorHandler');
const performance = require('./performance');
const resourceMonitor = require('./resourceMonitor');

// 安全相关模块
const compliance = require('./compliance');
const security = require('./security');
const permissionManager = require('./permissionManager');

module.exports = {
  // 核心功能模块
  Engine,
  Unpacker,
  Decompiler,
  Packer,
  
  // 工具模块
  platform,
  logger,
  errorHandler,
  performance,
  resourceMonitor,
  
  // 安全相关模块
  compliance,
  security,
  permissionManager
};