#!/usr/bin/env node

/**
 * 选择器配置测试脚本
 * 用于验证 selectors.json 配置文件的格式是否正确
 */

const fs = require('fs');
const path = require('path');

// ANSI 颜色代码
const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m',
};

function log(message, color = colors.reset) {
    console.log(`${color}${message}${colors.reset}`);
}

function testSelectorsConfig() {
    log('\n========================================', colors.cyan);
    log('  选择器配置测试工具', colors.cyan);
    log('========================================\n', colors.cyan);

    const selectorsPath = path.join(process.cwd(), 'selectors.json');
    const configPath = path.join(process.cwd(), 'config.json');

    // 测试 1: 检查文件是否存在
    log('📋 测试 1: 检查配置文件...', colors.blue);

    if (!fs.existsSync(selectorsPath)) {
        log('⚠️  selectors.json 不存在（将使用 config.json 中的配置）', colors.yellow);
    } else {
        log('✓ selectors.json 存在', colors.green);
    }

    if (!fs.existsSync(configPath)) {
        log('✗ config.json 不存在！', colors.red);
        process.exit(1);
    } else {
        log('✓ config.json 存在\n', colors.green);
    }

    // 测试 2: 解析 JSON
    log('📋 测试 2: 解析 JSON 格式...', colors.blue);

    let selectorsConfig = null;
    let configContent = null;

    try {
        if (fs.existsSync(selectorsPath)) {
            const content = fs.readFileSync(selectorsPath, 'utf-8');
            selectorsConfig = JSON.parse(content);
            log('✓ selectors.json 格式正确', colors.green);
        }
    } catch (error) {
        log(`✗ selectors.json 解析失败: ${error.message}`, colors.red);
        process.exit(1);
    }

    try {
        const content = fs.readFileSync(configPath, 'utf-8');
        configContent = JSON.parse(content);
        log('✓ config.json 格式正确\n', colors.green);
    } catch (error) {
        log(`✗ config.json 解析失败: ${error.message}`, colors.red);
        process.exit(1);
    }

    // 测试 3: 验证必需字段
    if (selectorsConfig) {
        log('📋 测试 3: 验证 selectors.json 结构...', colors.blue);

        const requiredFields = ['version', 'lastUpdated', 'selectors'];
        let allFieldsPresent = true;

        for (const field of requiredFields) {
            if (!selectorsConfig[field]) {
                log(`✗ 缺少必需字段: ${field}`, colors.red);
                allFieldsPresent = false;
            }
        }

        if (allFieldsPresent) {
            log('✓ 所有必需字段都存在', colors.green);
            log(`  版本: ${selectorsConfig.version}`, colors.cyan);
            log(`  更新日期: ${selectorsConfig.lastUpdated}\n`, colors.cyan);
        } else {
            process.exit(1);
        }
    }

    // 测试 4: 检查选择器配置
    log('📋 测试 4: 检查选择器配置...', colors.blue);

    const requiredSelectors = [
        'tweet',
        'tweetMoreButton',
        'deleteButton',
        'confirmDeleteButton',
        'unretweet',
        'unretweetConfirm',
        'unlikeButton',
        'removeBookmarkButton',
        'followingButton',
        'unfollowConfirm',
    ];

    let selectors = {};

    if (selectorsConfig && selectorsConfig.selectors) {
        // 从 selectors.json 获取，合并 customSelectors
        selectors = {
            ...selectorsConfig.selectors,
            ...(selectorsConfig.customSelectors || {}),
        };
    } else if (configContent && configContent.selectors) {
        // 从 config.json 获取
        selectors = configContent.selectors;
    } else {
        log('✗ 未找到任何选择器配置', colors.red);
        process.exit(1);
    }

    let missingSelectors = [];
    let validSelectors = [];

    for (const selectorName of requiredSelectors) {
        const selector = selectors[selectorName];

        // 检查选择器是否存在且有效
        const isObjectSelector = selector && typeof selector === 'object';
        const isValidObjectSelector = isObjectSelector ? Boolean(selector.primary) : true;
        const isValidStringSelector = typeof selector === 'string' && selector.trim().length > 0;

        if (!selector || (isObjectSelector && !isValidObjectSelector) || (!isObjectSelector && !isValidStringSelector)) {
            missingSelectors.push(selectorName);
        } else {
            validSelectors.push(selectorName);
        }
    }

    if (missingSelectors.length > 0) {
        log(`✗ 缺少以下必需选择器配置:`, colors.red);
        missingSelectors.forEach(name => {
            log(`   - ${name}`, colors.red);
        });
        log('\n请在 selectors.json 或 config.json 中添加缺失的选择器配置。', colors.yellow);
        process.exit(1);
    }

    log(`✓ 找到 ${validSelectors.length}/${requiredSelectors.length} 个必需选择器\n`, colors.green);

    // 测试 5: 验证选择器格式
    if (selectorsConfig && selectorsConfig.selectors) {
        log('📋 测试 5: 验证选择器格式...', colors.blue);

        let invalidSelectors = [];

        // 合并 selectors 和 customSelectors 进行格式验证
        const allSelectorObjects = {
            ...selectorsConfig.selectors,
            ...(selectorsConfig.customSelectors || {}),
        };

        for (const [name, config] of Object.entries(allSelectorObjects)) {
            if (typeof config === 'object') {
                if (!config.primary) {
                    invalidSelectors.push(`${name}: 缺少 primary 字段`);
                } else if (typeof config.primary !== 'string') {
                    invalidSelectors.push(`${name}: primary 字段必须是字符串`);
                } else if (config.primary.trim().length === 0) {
                    invalidSelectors.push(`${name}: primary 字段不能为空`);
                }
                if (config.fallback && typeof config.fallback !== 'string') {
                    invalidSelectors.push(`${name}: fallback 字段必须是字符串`);
                }
            }
        }

        if (invalidSelectors.length > 0) {
            log('✗ 发现格式错误:', colors.red);
            invalidSelectors.forEach(error => {
                log(`   - ${error}`, colors.red);
            });
            process.exit(1);
        } else {
            log('✓ 所有选择器格式正确\n', colors.green);
        }
    }

    // 测试 6: 显示选择器摘要
    log('📋 测试 6: 选择器摘要...', colors.blue);

    if (selectorsConfig && selectorsConfig.selectors) {
        const selectorEntries = Object.entries(selectorsConfig.selectors);
        log(`✓ 共配置 ${selectorEntries.length} 个选择器\n`, colors.green);

        log('选择器列表:', colors.cyan);
        selectorEntries.forEach(([name, config]) => {
            const hasFallback = config.fallback ? '✓' : '✗';
            const description = config.description ? `- ${config.description}` : '';
            log(`  ${name} [备用: ${hasFallback}] ${description}`, colors.reset);
        });
    } else {
        const selectorCount = Object.keys(selectors).length;
        log(`✓ 从 config.json 加载了 ${selectorCount} 个选择器`, colors.green);
    }

    // 最终结果
    log('\n========================================', colors.cyan);
    log('  ✓ 所有测试通过！', colors.green);
    log('========================================\n', colors.cyan);

    log('💡 提示:', colors.yellow);
    log('  1. 如果功能失效，请使用浏览器开发者工具查找新选择器');
    log('  2. 更新 selectors.json 中对应的 primary 或 fallback 字段');
    log('  3. 运行此脚本验证配置格式');
    log('  4. 重新启动程序测试\n');
}

// 运行测试
try {
    testSelectorsConfig();
} catch (error) {
    log(`\n✗ 测试失败: ${error.message}`, colors.red);
    console.error(error);
    process.exit(1);
}
