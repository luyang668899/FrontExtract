/**
 * 测试覆盖率监控脚本
 * 用于检查代码测试覆盖率，确保不低于设定的阈值
 */

const fs = require('fs');
const path = require('path');

// 设定覆盖率阈值
const COVERAGE_THRESHOLDS = {
  global: 85, // 整体覆盖率阈值
  engine: 85, // engine.js 模块覆盖率阈值
  decompiler: 85, // decompiler.js 模块覆盖率阈值
  packer: 85, // packer.js 模块覆盖率阈值
  unpacker: 85, // unpacker.js 模块覆盖率阈值
};

/**
 * 读取覆盖率报告
 * @param {string} coveragePath - 覆盖率报告路径
 * @returns {object} 覆盖率数据
 */
function readCoverageReport(coveragePath) {
  try {
    const coverageData = fs.readFileSync(coveragePath, 'utf8');
    return JSON.parse(coverageData);
  } catch (error) {
    console.error('读取覆盖率报告失败:', error.message);
    process.exit(1);
  }
}

/**
 * 计算文件的行覆盖率
 * @param {object} fileData - 文件覆盖率数据
 * @returns {number} 行覆盖率百分比
 */
function calculateLineCoverage(fileData) {
  const statements = fileData.s;
  const totalStatements = Object.keys(statements).length;
  const coveredStatements = Object.values(statements).filter(count => count > 0).length;
  
  if (totalStatements === 0) return 0;
  return (coveredStatements / totalStatements) * 100;
}

/**
 * 计算整体覆盖率
 * @param {object} coverageData - 覆盖率数据
 * @returns {number} 整体覆盖率百分比
 */
function calculateGlobalCoverage(coverageData) {
  let totalStatements = 0;
  let coveredStatements = 0;
  
  Object.values(coverageData).forEach(fileData => {
    const statements = fileData.s;
    const fileTotal = Object.keys(statements).length;
    const fileCovered = Object.values(statements).filter(count => count > 0).length;
    
    totalStatements += fileTotal;
    coveredStatements += fileCovered;
  });
  
  if (totalStatements === 0) return 0;
  return (coveredStatements / totalStatements) * 100;
}

/**
 * 获取文件的相对路径
 * @param {string} absolutePath - 绝对路径
 * @returns {string} 相对路径
 */
function getRelativePath(absolutePath) {
  const projectRoot = path.join(__dirname, '..');
  return path.relative(projectRoot, absolutePath);
}

/**
 * 检查覆盖率是否达标
 * @param {object} coverageData - 覆盖率数据
 * @returns {boolean} 是否达标
 */
function checkCoverage(coverageData) {
  let allPassed = true;
  
  console.log('=== 测试覆盖率检查 ===\n');
  
  // 计算整体覆盖率
  const globalCoverage = calculateGlobalCoverage(coverageData);
  console.log(`整体覆盖率: ${globalCoverage.toFixed(2)}% (阈值: ${COVERAGE_THRESHOLDS.global}%)`);
  
  if (globalCoverage < COVERAGE_THRESHOLDS.global) {
    console.log('❌ 整体覆盖率未达标');
    allPassed = false;
  } else {
    console.log('✅ 整体覆盖率达标');
  }
  
  console.log('');
  
  // 检查各个模块的覆盖率
  const modules = [
    { name: 'engine', path: 'src/modules/engine.js' },
    { name: 'decompiler', path: 'src/modules/decompiler.js' },
    { name: 'packer', path: 'src/modules/packer.js' },
    { name: 'unpacker', path: 'src/modules/unpacker.js' },
  ];
  
  modules.forEach(module => {
    // 查找模块文件
    let fileCoverage = null;
    for (const [absolutePath, data] of Object.entries(coverageData)) {
      const relativePath = getRelativePath(absolutePath);
      if (relativePath === module.path) {
        fileCoverage = data;
        break;
      }
    }
    
    if (fileCoverage) {
      const moduleCoverage = calculateLineCoverage(fileCoverage);
      console.log(`${module.name} 模块覆盖率: ${moduleCoverage.toFixed(2)}% (阈值: ${COVERAGE_THRESHOLDS[module.name]}%)`);
      
      if (moduleCoverage < COVERAGE_THRESHOLDS[module.name]) {
        console.log(`❌ ${module.name} 模块覆盖率未达标`);
        allPassed = false;
      } else {
        console.log(`✅ ${module.name} 模块覆盖率达标`);
      }
    } else {
      console.log(`${module.name} 模块: 未找到覆盖率数据`);
      console.log(`❌ ${module.name} 模块覆盖率未达标`);
      allPassed = false;
    }
    console.log('');
  });
  
  // 检查其他核心模块
  const otherCoreModules = [
    'src/modules/resourceMonitor.js',
    'src/modules/performance.js',
    'src/modules/security.js',
  ];
  
  console.log('=== 其他核心模块覆盖率 ===\n');
  
  otherCoreModules.forEach(modulePath => {
    // 查找模块文件
    let fileCoverage = null;
    for (const [absolutePath, data] of Object.entries(coverageData)) {
      const relativePath = getRelativePath(absolutePath);
      if (relativePath === modulePath) {
        fileCoverage = data;
        break;
      }
    }
    
    if (fileCoverage) {
      const moduleCoverage = calculateLineCoverage(fileCoverage);
      const moduleName = path.basename(modulePath, '.js');
      console.log(`${moduleName} 模块覆盖率: ${moduleCoverage.toFixed(2)}%`);
      
      if (moduleCoverage < 70) { // 其他模块的阈值可以设置得低一些
        console.log(`⚠️ ${moduleName} 模块覆盖率较低，建议提升`);
      } else {
        console.log(`✅ ${moduleName} 模块覆盖率达标`);
      }
    } else {
      const moduleName = path.basename(modulePath, '.js');
      console.log(`${moduleName} 模块: 未找到覆盖率数据`);
      console.log(`⚠️ ${moduleName} 模块需要添加测试`);
    }
    console.log('');
  });
  
  return allPassed;
}

/**
 * 生成覆盖率报告并检查
 */
async function generateAndCheckCoverage() {
  const { execSync } = require('child_process');
  
  console.log('正在生成测试覆盖率报告...\n');
  
  try {
    // 运行测试并生成覆盖率报告
    execSync('npm run test:coverage', { stdio: 'inherit' });
    
    // 读取覆盖率报告
    const coveragePath = path.join(__dirname, '..', 'coverage', 'coverage-final.json');
    
    if (!fs.existsSync(coveragePath)) {
      console.error('覆盖率报告文件不存在');
      process.exit(1);
    }
    
    const coverageData = readCoverageReport(coveragePath);
    const passed = checkCoverage(coverageData);
    
    if (passed) {
      console.log('🎉 所有模块的测试覆盖率都已达标!');
      process.exit(0);
    } else {
      console.log('❌ 部分模块的测试覆盖率未达标，请添加更多测试用例.');
      process.exit(1);
    }
  } catch (error) {
    console.error('运行测试失败:', error.message);
    process.exit(1);
  }
}

// 执行覆盖率检查
if (require.main === module) {
  generateAndCheckCoverage();
}

module.exports = {
  checkCoverage,
  readCoverageReport,
  COVERAGE_THRESHOLDS
};
