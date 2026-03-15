/**
 * 测试角色配置
 * 验证每个 Agent 的 System Prompt 是否正确生成
 */

const { 
  generateSystemPrompt, 
  getAvailableRoles, 
  getRoleDetails 
} = require('./agent-roles');

console.log('\n========================================');
console.log('🎭 多 Agent 角色系统测试');
console.log('========================================\n');

// 测试 1: 获取所有可用角色
console.log('📋 测试 1: 获取所有可用角色\n');
const roles = getAvailableRoles();
roles.forEach(role => {
  console.log(`  - ${role.id}: ${role.name}`);
  console.log(`    ${role.description}\n`);
});

// 测试 2: 生成选品 Agent 的 System Prompt
console.log('\n📋 测试 2: 生成选品 Agent 的 System Prompt\n');
const selectorPrompt = generateSystemPrompt('product_selector', {
  type: 'product_selection',
  category: '电子产品',
  target_market: '北美'
}, {
  workflow_id: 'wf_test_001',
  timestamp: new Date().toISOString()
});

console.log('生成的 System Prompt (前 500 字符):');
console.log('----------------------------------------');
console.log(selectorPrompt.substring(0, 500));
console.log('----------------------------------------');
console.log(`完整长度：${selectorPrompt.length} 字符\n`);

// 测试 3: 生成风控 Agent 的 System Prompt
console.log('\n📋 测试 3: 生成风控 Agent 的 System Prompt\n');
const riskPrompt = generateSystemPrompt('risk_controller', {
  type: 'risk_assessment',
  product: {
    name: '无线耳机',
    category: '电子产品',
    price: 29.99
  }
}, {
  workflow_id: 'wf_test_001',
  previous_stage: 'product_selector',
  previous_result: {
    risk_score: 0.8,
    passed: true
  }
});

console.log('生成的 System Prompt (前 500 字符):');
console.log('----------------------------------------');
console.log(riskPrompt.substring(0, 500));
console.log('----------------------------------------');
console.log(`完整长度：${riskPrompt.length} 字符\n`);

// 测试 4: 生成设计 Agent 的 System Prompt
console.log('\n📋 测试 4: 生成设计 Agent 的 System Prompt\n');
const designerPrompt = generateSystemPrompt('designer', {
  type: 'design_creation',
  product: {
    name: '无线耳机',
    category: '电子产品',
    passed_risk: true
  }
}, {
  workflow_id: 'wf_test_001',
  previous_stage: 'risk_controller'
});

console.log('生成的 System Prompt (前 500 字符):');
console.log('----------------------------------------');
console.log(designerPrompt.substring(0, 500));
console.log('----------------------------------------');
console.log(`完整长度：${designerPrompt.length} 字符\n`);

// 测试 5: 验证角色详情
console.log('\n📋 测试 5: 验证角色详情\n');
const designerRole = getRoleDetails('designer');
console.log(`角色：${designerRole.name}`);
console.log(`职责数量：${designerRole.responsibilities.length}`);
console.log(`约束数量：${designerRole.constraints.length}`);
console.log('职责列表:');
designerRole.responsibilities.forEach(r => console.log(`  - ${r}`));

console.log('\n========================================');
console.log('✅ 所有测试完成！');
console.log('========================================\n');
