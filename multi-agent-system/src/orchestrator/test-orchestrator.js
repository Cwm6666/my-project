/**
 * 测试协调者 Agent
 */

const Orchestrator = require('./Orchestrator');

console.log('\n========================================');
console.log('🎼 协调者 Agent 测试');
console.log('========================================\n');

// 创建协调者实例
const orchestrator = new Orchestrator({
  max_retries: 3,
  quality_threshold: 0.6,
  timeout_ms: 300000
});

// 测试 1: 查看初始状态
console.log('📋 测试 1: 查看初始状态\n');
const initial_status = orchestrator.getStatus();
console.log('初始状态:', JSON.stringify(initial_status, null, 2));

// 测试 2: 启动工作流
console.log('\n📋 测试 2: 启动工作流\n');

const user_task = {
  type: 'product_launch',
  category: '电子产品',
  target_market: '北美',
  budget: 10000,
  timeline: '2 周'
};

console.log('用户任务:', JSON.stringify(user_task, null, 2));
console.log('\n开始执行工作流...\n');

// 启动工作流（这会模拟执行所有阶段）
orchestrator.startWorkflow(user_task)
  .then(result => {
    console.log('\n========================================');
    console.log('✅ 工作流执行完成！');
    console.log('========================================\n');
    
    console.log('执行结果:', JSON.stringify(result, null, 2));
    
    // 测试 3: 查看最终状态
    console.log('\n📋 测试 3: 查看最终状态\n');
    const final_status = orchestrator.getStatus();
    console.log('最终状态:', JSON.stringify(final_status, null, 2));
    
    // 测试 4: 查看共享上下文
    console.log('\n📋 测试 4: 查看共享上下文\n');
    const context_state = orchestrator.context.getFullState();
    console.log(`工作流 ID: ${context_state.workflow_id}`);
    console.log(`状态：${context_state.workflow_status}`);
    console.log(`Agent 数量：${Object.keys(context_state.agents).length}`);
    console.log(`任务包数量：${context_state.task_packets.length}`);
    console.log(`事件数量：${context_state.events.length}`);
    
    // 测试 5: 查看任务历史
    console.log('\n📋 测试 5: 查看任务历史\n');
    const task_history = orchestrator.context.getTaskPacketHistory(10);
    task_history.forEach((task, index) => {
      console.log(`${index + 1}. ${task.id}`);
      console.log(`   阶段：${task.stage}, Agent: ${task.agent_id}`);
      console.log(`   状态：${task.status}`);
      console.log(`   质量评分：${task.quality_score || 'N/A'}`);
      if (task.output) {
        console.log(`   输出：${JSON.stringify(task.output).substring(0, 100)}...`);
      }
      console.log('');
    });
    
    // 测试 6: 查看质量门禁记录
    console.log('📋 测试 6: 查看质量门禁记录\n');
    context_state.quality_gates.forEach((gate, index) => {
      console.log(`${index + 1}. 阶段 ${gate.stage}`);
      console.log(`   结果：${gate.passed ? '通过' : '失败'}`);
      console.log(`   评分：${gate.score}`);
      console.log('');
    });
    
    // 测试 7: 查看共享数据
    console.log('📋 测试 7: 查看共享数据\n');
    const shared_data = orchestrator.context.getSharedData();
    Object.keys(shared_data).forEach(key => {
      if (key.startsWith('stage_')) {
        console.log(`${key}:`);
        console.log(`  ${JSON.stringify(shared_data[key], null, 2)}`);
      }
    });
    
    console.log('\n========================================');
    console.log('🎉 所有协调者测试完成！');
    console.log('========================================\n');
    
  })
  .catch(error => {
    console.error('\n❌ 工作流执行失败:', error.message);
    console.error(error.stack);
  });
