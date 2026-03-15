/**
 * 多 Agent 系统 - HTTP API 服务器
 * 
 * 用于将多 Agent 系统暴露为 REST API，供其他系统调用
 * 
 * 用法：
 *   node src/api/server.js
 */

const http = require('http');
const url = require('url');
const Orchestrator = require('../orchestrator/Orchestrator');

// 配置
const PORT = process.env.PORT || 3002;
const API_KEY = process.env.API_KEY || 'multi-agent-api-key';

// 创建协调者实例（单例）
const orchestrator = new Orchestrator({
  use_real_agent: process.env.USE_REAL_AGENT === 'true',
  quality_threshold: parseFloat(process.env.QUALITY_THRESHOLD) || 0.6,
  max_retries: parseInt(process.env.MAX_RETRIES) || 3,
  timeout_ms: parseInt(process.env.TIMEOUT_MS) || 300000
});

// 存储活跃的工作流
const activeWorkflows = new Map();

// 简单的路由处理
const routes = {
  // 健康检查
  'GET /health': async (req, res) => {
    const status = orchestrator.getStatus();
    res.json({
      status: 'OK',
      workflow_status: status.workflow.status,
      agents_count: status.workflow.agents.length,
      active_workflows: activeWorkflows.size,
      timestamp: new Date().toISOString()
    });
  },
  
  // 获取系统状态
  'GET /api/status': async (req, res) => {
    const status = orchestrator.getStatus();
    res.json(status);
  },
  
  // 提交新工作流
  'POST /api/workflow': async (req, res) => {
    const { task, options = {} } = req.body;
    
    if (!task) {
      return res.status(400).json({ 
        success: false, 
        error: '任务不能为空' 
      });
    }
    
    try {
      // 创建新的协调者实例处理此工作流
      const workflowOrchestrator = new Orchestrator({
        use_real_agent: options.use_real_agent || orchestrator.config.use_real_agent,
        quality_threshold: options.quality_threshold || orchestrator.config.quality_threshold,
        max_retries: options.max_retries || orchestrator.config.max_retries,
        timeout_ms: options.timeout_ms || orchestrator.config.timeout_ms
      });
      
      // 启动工作流（不等待完成，异步处理）
      const workflowPromise = workflowOrchestrator.startWorkflow(task)
        .then(result => {
          activeWorkflows.set(result.workflow_id, {
            status: 'completed',
            result,
            completed_at: new Date().toISOString()
          });
          return result;
        })
        .catch(error => {
          activeWorkflows.set(task.workflow_id || 'unknown', {
            status: 'failed',
            error: error.message,
            failed_at: new Date().toISOString()
          });
          throw error;
        });
      
      const workflow_id = `wf_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // 记录活跃工作流
      activeWorkflows.set(workflow_id, {
        status: 'running',
        started_at: new Date().toISOString(),
        promise: workflowPromise
      });
      
      res.json({
        success: true,
        workflow_id,
        status: 'running',
        message: '工作流已启动，异步处理中'
      });
      
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  },
  
  // 查询工作流状态
  'GET /api/workflow/:id': async (req, res) => {
    const workflow_id = req.params.id;
    const workflow = activeWorkflows.get(workflow_id);
    
    if (!workflow) {
      return res.status(404).json({
        success: false,
        error: '工作流不存在'
      });
    }
    
    res.json({
      success: true,
      workflow_id,
      status: workflow.status,
      started_at: workflow.started_at,
      completed_at: workflow.completed_at || workflow.failed_at,
      result: workflow.result,
      error: workflow.error
    });
  },
  
  // 获取所有活跃工作流
  'GET /api/workflows': async (req, res) => {
    const workflows = Array.from(activeWorkflows.entries()).map(([id, data]) => ({
      workflow_id: id,
      status: data.status,
      started_at: data.started_at,
      completed_at: data.completed_at || data.failed_at
    }));
    
    res.json({
      success: true,
      count: workflows.length,
      workflows
    });
  },
  
  // 获取共享数据
  'GET /api/context/:key': async (req, res) => {
    const key = req.params.key;
    const data = orchestrator.context.getSharedData(key);
    
    res.json({
      success: true,
      key,
      data
    });
  },
  
  // 获取任务历史
  'GET /api/tasks': async (req, res) => {
    const limit = parseInt(req.query.limit) || 10;
    const tasks = orchestrator.context.getTaskPacketHistory(limit);
    
    res.json({
      success: true,
      count: tasks.length,
      tasks
    });
  },
  
  // 重置系统
  'POST /api/reset': async (req, res) => {
    orchestrator.context.reset();
    activeWorkflows.clear();
    
    res.json({
      success: true,
      message: '系统已重置'
    });
  }
};

// 创建 HTTP 服务器
const server = http.createServer(async (req, res) => {
  // 解析 URL
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;
  const method = req.method;
  
  // CORS 头
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-API-Key');
  
  // 处理 OPTIONS 请求
  if (method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }
  
  // API 密钥验证（生产环境启用）
  if (process.env.NODE_ENV === 'production') {
    const apiKey = req.headers['x-api-key'];
    if (apiKey !== API_KEY) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: '未授权' }));
      return;
    }
  }
  
  // 解析 JSON 请求体
  let body = {};
  if (method === 'POST' || method === 'PUT') {
    try {
      body = await parseJsonBody(req);
      req.body = body;
    } catch (error) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: '无效的 JSON' }));
      return;
    }
  }
  
  // 解析路径参数
  const pathParts = pathname.split('/');
  req.params = {};
  req.query = parsedUrl.query;
  
  // 匹配路由
  let handler = null;
  let routeKey = `${method} ${pathname}`;
  
  // 精确匹配
  if (routes[routeKey]) {
    handler = routes[routeKey];
  } else {
    // 模糊匹配（处理 :id 参数）
    for (const [key, value] of Object.entries(routes)) {
      const [routeMethod, routePath] = key.split(' ');
      if (routeMethod === method) {
        const routeParts = routePath.split('/');
        if (routeParts.length === pathParts.length) {
          const match = routeParts.every((part, i) => 
            part === pathParts[i] || part.startsWith(':')
          );
          if (match) {
            // 提取参数
            routeParts.forEach((part, i) => {
              if (part.startsWith(':')) {
                req.params[part.slice(1)] = pathParts[i];
              }
            });
            handler = value;
            break;
          }
        }
      }
    }
  }
  
  // 处理请求
  if (handler) {
    try {
      // 添加 json 辅助方法
      res.json = (data) => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(data));
      };
      
      await handler(req, res);
    } catch (error) {
      console.error('路由处理错误:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: error.message }));
    }
  } else {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: '未找到' }));
  }
});

// 解析 JSON 请求体
function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

// 启动服务器
server.listen(PORT, () => {
  console.log('\n========================================');
  console.log('🚀 多 Agent 系统 API 服务器');
  console.log('========================================');
  console.log(`端口：${PORT}`);
  console.log(`模式：${process.env.NODE_ENV || 'development'}`);
  console.log(`真实 Agent: ${orchestrator.config.use_real_agent ? '是' : '否'}`);
  console.log('\nAPI 端点:');
  console.log(`  GET  /health              - 健康检查`);
  console.log(`  GET  /api/status          - 系统状态`);
  console.log(`  POST /api/workflow        - 提交工作流`);
  console.log(`  GET  /api/workflow/:id    - 查询工作流状态`);
  console.log(`  GET  /api/workflows       - 所有工作流`);
  console.log(`  GET  /api/context/:key    - 获取共享数据`);
  console.log(`  GET  /api/tasks           - 任务历史`);
  console.log(`  POST /api/reset           - 重置系统`);
  console.log('\n示例:');
  console.log(`  curl http://localhost:${PORT}/health`);
  console.log(`  curl -X POST http://localhost:${PORT}/api/workflow \\`);
  console.log(`    -H "Content-Type: application/json" \\`);
  console.log(`    -d '{"task":{"type":"product_launch","category":"电子产品"}}'`);
  console.log('========================================\n');
});

module.exports = server;
