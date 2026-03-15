/**
 * 测试集成真实 Agent 执行
 * 
 * 用法：
 * 1. 模拟模式（默认）：node test-integration.js
 * 2. 真实模式：node test-integration.js --real
 */

const Orchestrator = require('./Orchestrator');

// 解析命令行参数
const args = process.argv.slice(2);
const use_real_agent = args.includes('--real') || args.includes('-r');

console.log('\n========================================');
console.log('🔌 多 Agent 系统集成测试');
console.log('========================================\n');

console.log(`执行模式：${use_real_agent ? '🔴 真实 Agent 执行' : '🟢 模拟执行（测试）'}`);

// 创建协调者实例
const orchestrator = new Orchestrator({
  max_retries: 3,
  quality_threshold: 0.6,
  timeout_ms: 300000,
  use_real_agent,
  workspace: 'C:/Users/曹伟铭/.openclaw/workspace'
});

// 用户任务
const user_task = {
  type: 'product_launch',
  category: '智能穿戴',
  target_market: '北美',
  budget: 15000,
  timeline: '3 周',
  requirements: [
    '高利润率（>25%）',
    '低竞争度',
    '供应链稳定',
    '无知识产权风险'
  ]
};

console.log('\n📋 用户任务:', JSON.stringify(user_task, null, 2));
console.log('\n开始执行工作流...\n');

// 启动工作流
orchestrator.startWorkflow(user_task)
  .then(result => {
    console.log('\n========================================');
    console.log('✅ 工作流执行完成！');
    console.log('========================================\n');
    
    console.log('执行结果:', JSON.stringify(result, null, 2));
    
    // 查看最终状态
    console.log('\n📋 最终状态:\n');
    const final_status = orchestrator.getStatus();
    console.log('工作流状态:', JSON.stringify(final_status.workflow, null, 2));
    
    // 查看共享数据
    console.log('\n📋 各阶段结果:\n');
    const shared_data = orchestrator.context.getSharedData();
    Object.keys(shared_data).forEach(key => {
      if (key.startsWith('stage_')) {
        console.log(`${key}:`);
        console.log(`  ${JSON.stringify(shared_data[key], null, 2)}\n`);
      }
    });
    
    // 生成总结报告
    console.log('📋 总结报告:\n');
    console.log(`工作流 ID: ${final_status.workflow.workflow_id}`);
    console.log(`状态：${final_status.workflow.status}`);
    console.log(`执行模式：${use_real_agent ? '真实 Agent' : '模拟执行'}`);
    console.log(`Agent 数量：${final_status.workflow.agents.length}`);
    console.log(`总耗时：${new Date(final_status.workflow.completed_at) - new Date(final_status.workflow.started_at)}ms`);
    
    console.log('\n========================================');
    console.log('🎉 集成测试完成！');
    console.log('========================================\n');
    
  })
  .catch(error => {
    console.error('\n❌ 工作流执行失败:', error.message);
    console.error(error.stack);
    
    console.log('\n========================================');
    console.log('⚠️ 测试失败');
    console.log('========================================\n');
  });
