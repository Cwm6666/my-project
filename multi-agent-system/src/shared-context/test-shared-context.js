/**
 * 测试 SharedContext
 */

const SharedContext = require('./SharedContext');

console.log('\n========================================');
console.log('🔄 SharedContext 测试');
console.log('========================================\n');

// 创建 SharedContext 实例
const context = new SharedContext({
  persist: false,
  max_events: 100,
  max_task_packets: 50
});

// 测试 1: 启动工作流
console.log('📋 测试 1: 启动工作流\n');
const workflow = context.startWorkflow('wf_test_001', 3, {
  user_id: 'user_123',
  priority: 'high'
});
console.log('工作流状态:', JSON.stringify(workflow, null, 2));

// 测试 2: 注册 Agent
console.log('\n📋 测试 2: 注册 Agent\n');
context.registerAgent('agent_001', 'product_selector');
context.registerAgent('agent_002', 'risk_controller');
context.registerAgent('agent_003', 'designer');

const agents = context.getAgentsStatus();
console.log('已注册 Agent:');
agents.forEach(agent => {
  console.log(`  - ${agent.agent_id}: ${agent.role} (${agent.status})`);
});

// 测试 3: 更新 Agent 状态
console.log('\n📋 测试 3: 更新 Agent 状态\n');
context.updateAgentStatus('agent_001', 'busy', {
  task: '选品分析',
  stage: 1
});

const agent1 = context.state.agents['agent_001'];
console.log(`agent_001 状态：${agent1.status}`);
console.log(`当前任务：${JSON.stringify(agent1.current_task)}`);

// 测试 4: 添加任务包
console.log('\n📋 测试 4: 添加任务包\n');
const task1 = context.addTaskPacket({
  id: 'task_001',
  stage: 1,
  agent_id: 'agent_001',
  status: 'processing',
  input: {
    category: '电子产品',
    target_market: '北美'
  }
});
console.log('任务包:', JSON.stringify(task1, null, 2));

// 测试 5: 更新任务包
console.log('\n📋 测试 5: 更新任务包\n');
const updated_task = context.updateTaskPacket('task_001', {
  status: 'completed',
  output: {
    product_name: '无线耳机',
    estimated_profit: '25%',
    recommendation_reason: '市场需求大，竞争小'
  }
});
console.log('更新后的任务包:', JSON.stringify(updated_task, null, 2));

// 测试 6: 质量门禁
console.log('\n📋 测试 6: 质量门禁\n');
const quality_result = context.recordQualityGate(1, true, 0.85, {
  factors: ['利润率高', '风险低', '供应链稳定']
});
console.log('质量门禁结果:', JSON.stringify(quality_result, null, 2));

// 测试 7: 推进阶段
console.log('\n📋 测试 7: 推进阶段\n');
const next_stage = context.nextStage();
console.log(`当前阶段：${next_stage}/${context.state.total_stages}`);

// 测试 8: 设置共享数据
console.log('\n📋 测试 8: 设置共享数据\n');
context.setSharedData('selected_product', {
  name: '无线耳机',
  price: 29.99,
  category: '电子产品'
});

const product = context.getSharedData('selected_product');
console.log('共享数据 - 选中的商品:', JSON.stringify(product, null, 2));

// 测试 9: 团队概览
console.log('\n📋 测试 9: 团队概览\n');
const overview = context.getTeamOverview();
console.log('团队概览:', JSON.stringify(overview, null, 2));

// 测试 10: 获取工作流状态
console.log('\n📋 测试 10: 获取完整工作流状态\n');
const full_status = context.getWorkflowStatus();
console.log('完整状态:', JSON.stringify(full_status, null, 2));

// 测试 11: 事件监听
console.log('\n📋 测试 11: 事件监听\n');
let event_count = 0;
const unsubscribe = context.on('*', (event, data) => {
  event_count++;
  console.log(`  [事件] ${event}`);
});

// 触发一些事件
context.updateAgentStatus('agent_002', 'busy', { task: '风险评估' });
context.addTaskPacket({
  id: 'task_002',
  stage: 2,
  agent_id: 'agent_002',
  status: 'pending'
});

console.log(`捕获到 ${event_count} 个事件`);
unsubscribe();

// 测试 12: 获取任务历史
console.log('\n📋 测试 12: 获取任务历史\n');
const history = context.getTaskPacketHistory(10);
console.log(`任务历史数量：${history.length}`);
history.forEach(task => {
  console.log(`  - ${task.id}: ${task.status} (阶段 ${task.stage})`);
});

// 测试 13: 完整工作流示例
console.log('\n📋 测试 13: 模拟完整工作流\n');

// 阶段 1: 选品
context.updateAgentStatus('agent_001', 'idle');
context.updateTaskPacket('task_001', { status: 'completed' });
context.recordQualityGate(1, true, 0.85);

// 阶段 2: 风控
context.updateAgentStatus('agent_002', 'busy', { task: '风险评估' });
context.addTaskPacket({
  id: 'task_002',
  stage: 2,
  agent_id: 'agent_002',
  status: 'completed',
  output: { risk_score: 0.8, passed: true }
});
context.recordQualityGate(2, true, 0.8);
context.nextStage();

// 阶段 3: 设计
context.updateAgentStatus('agent_003', 'busy', { task: '设计素材' });
context.addTaskPacket({
  id: 'task_003',
  stage: 3,
  agent_id: 'agent_003',
  status: 'completed',
  output: { design_url: 'https://example.com/design.png' }
});
context.recordQualityGate(3, true, 0.9);
context.nextStage();

// 完成工作流
context.completeWorkflow({
  success: true,
  product: '无线耳机',
  total_time: '15 分钟'
});

console.log('最终工作流状态:', JSON.stringify(context.getWorkflowStatus(), null, 2));

// 测试 14: 获取完整状态（调试用）
console.log('\n📋 测试 14: 获取完整状态（用于调试）\n');
const full_state = context.getFullState();
console.log(`工作流 ID: ${full_state.workflow_id}`);
console.log(`状态：${full_state.workflow_status}`);
console.log(`Agent 数量：${Object.keys(full_state.agents).length}`);
console.log(`任务包数量：${full_state.task_packets.length}`);
console.log(`事件数量：${full_state.events.length}`);

console.log('\n========================================');
console.log('✅ 所有 SharedContext 测试完成！');
console.log('========================================\n');
