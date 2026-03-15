#!/usr/bin/env node

/**
 * 多 Agent 系统 - 命令行启动脚本
 * 
 * 用法：
 *   node bin/start.js                          # 模拟模式启动
 *   node bin/start.js --real                   # 真实 Agent 模式
 *   node bin/start.js --task "选品：电子产品"   # 自定义任务
 */

const Orchestrator = require('../src/orchestrator/Orchestrator');

// 解析命令行参数
function parseArgs() {
  const args = process.argv.slice(2);
  const config = {
    real: false,
    task: null,
    help: false
  };
  
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--real' || args[i] === '-r') {
      config.real = true;
    } else if (args[i] === '--task' || args[i] === '-t') {
      config.task = args[++i];
    } else if (args[i] === '--help' || args[i] === '-h') {
      config.help = true;
    }
  }
  
  return config;
}

// 显示帮助
function showHelp() {
  console.log(`
🎭 多 Agent 协作系统

用法：
  node bin/start.js [选项]

选项：
  --real, -r          使用真实 Agent 执行（默认：模拟模式）
  --task, -t <任务>    自定义任务描述
  --help, -h          显示帮助

示例：
  node bin/start.js
  node bin/start.js --real
  node bin/start.js --task "选品：电子产品，目标市场：北美"

模式说明：
  - 模拟模式：快速测试，使用模拟数据
  - 真实模式：调用 OpenClaw sessions_spawn 执行真实 Agent
`);
}

// 主函数
async function main() {
  const config = parseArgs();
  
  if (config.help) {
    showHelp();
    return;
  }
  
  console.log('\n========================================');
  console.log('🎭 多 Agent 协作系统 v1.0.0');
  console.log('========================================\n');
  
  console.log(`执行模式：${config.real ? '🔴 真实 Agent' : '🟢 模拟执行'}`);
  
  // 构建用户任务
  const user_task = config.task ? {
    type: 'custom',
    description: config.task,
    timestamp: new Date().toISOString()
  } : {
    type: 'product_launch',
    category: '智能穿戴',
    target_market: '北美',
    budget: 15000,
    timeline: '3 周'
  };
  
  console.log('\n📋 用户任务:', JSON.stringify(user_task, null, 2));
  
  // 创建协调者
  const orchestrator = new Orchestrator({
    max_retries: 3,
    quality_threshold: 0.6,
    timeout_ms: 300000,
    use_real_agent: config.real,
    workspace: process.env.OPENCLAW_WORKSPACE || './workspace'
  });
  
  console.log('\n开始执行工作流...\n');
  
  try {
    // 启动工作流
    const result = await orchestrator.startWorkflow(user_task);
    
    console.log('\n========================================');
    console.log('✅ 工作流执行完成！');
    console.log('========================================\n');
    
    // 显示结果
    console.log('执行结果:', JSON.stringify(result, null, 2));
    
    // 显示总结
    const status = orchestrator.getStatus();
    console.log('\n📊 执行总结:');
    console.log(`  工作流 ID: ${status.workflow.workflow_id}`);
    console.log(`  状态：${status.workflow.status}`);
    console.log(`  执行模式：${config.real ? '真实 Agent' : '模拟执行'}`);
    console.log(`  Agent 数量：${status.workflow.agents.length}`);
    console.log(`  总耗时：${new Date(status.workflow.completed_at) - new Date(status.workflow.started_at)}ms`);
    
    console.log('\n🎉 完成！\n');
    
  } catch (error) {
    console.error('\n❌ 执行失败:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// 运行
main();
