# 多 Agent 系统集成指南

**将多 Agent 系统集成到跨境电商生产环境**

---

## 📋 集成步骤

### 步骤 1：上传代码到服务器

```bash
# 在本地电脑执行
cd C:\Users\曹伟铭\.openclaw\workspace\multi-agent-system

# 方式 1：使用 Git 推送
git add .
git commit -m "Add multi-agent system"
git push origin main

# 方式 2：使用 SCP 上传
scp -r ./* root@你的服务器 IP:~/multi-agent-system
```

### 步骤 2：在服务器上安装

```bash
# SSH 登录服务器
ssh root@你的服务器 IP

# 进入项目目录
cd ~/multi-agent-system

# 安装依赖（如果有）
npm install --production
```

### 步骤 3：配置环境变量

```bash
# 创建 .env 文件
cat > .env << 'EOF'
# OpenClaw 配置
OPENCLAW_WORKSPACE=/root/.openclaw/workspace

# 系统配置
NODE_ENV=production
LOG_LEVEL=info

# 质量配置
QUALITY_THRESHOLD=0.6
MAX_RETRIES=3

# 超时配置（毫秒）
TIMEOUT_MS=300000
EOF
```

### 步骤 4：使用 PM2 部署

```bash
# 创建 PM2 配置文件
cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [{
    name: 'multi-agent-system',
    script: 'bin/start.js',
    cwd: '/root/multi-agent-system',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      OPENCLAW_WORKSPACE: '/root/.openclaw/workspace',
      QUALITY_THRESHOLD: '0.6',
      MAX_RETRIES: '3',
      TIMEOUT_MS: '300000'
    },
    error_file: './logs/error.log',
    out_file: './logs/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss'
  }]
};
EOF

# 启动应用
pm2 start ecosystem.config.js

# 保存 PM2 配置
pm2 save

# 查看状态
pm2 status
```

---

## 🔌 API 集成

### 方式 1：HTTP API（推荐）

创建 HTTP 服务器：

```javascript
// src/api/server.js
const express = require('express');
const Orchestrator = require('../orchestrator/Orchestrator');

const app = express();
app.use(express.json());

const orchestrator = new Orchestrator({
  use_real_agent: true,
  quality_threshold: 0.6,
  max_retries: 3
});

// 提交任务
app.post('/api/workflow', async (req, res) => {
  try {
    const { task } = req.body;
    
    if (!task) {
      return res.status(400).json({ error: '任务不能为空' });
    }
    
    const result = await orchestrator.startWorkflow(task);
    
    res.json({
      success: true,
      workflow_id: result.workflow_id,
      status: result.status
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 查询状态
app.get('/api/workflow/:id', async (req, res) => {
  const status = orchestrator.getStatus();
  res.json(status);
});

// 启动服务器
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`API 服务器运行在端口 ${PORT}`);
});

module.exports = app;
```

### 方式 2：直接模块调用

```javascript
// 在你的电商系统中
const Orchestrator = require('./multi-agent-system/src/orchestrator/Orchestrator');

async function launchProduct(productData) {
  const orchestrator = new Orchestrator({
    use_real_agent: true
  });
  
  const result = await orchestrator.startWorkflow({
    type: 'product_launch',
    ...productData
  });
  
  return result;
}

// 使用
const result = await launchProduct({
  category: '电子产品',
  target_market: '北美',
  budget: 10000
});
```

---

## 📊 监控和日志

### 查看 PM2 日志

```bash
# 查看所有日志
pm2 logs multi-agent-system

# 实时查看
pm2 monit
```

### 添加健康检查

```javascript
// 在 app.js 中添加
app.get('/health', (req, res) => {
  const status = orchestrator.getStatus();
  res.json({
    status: 'OK',
    workflow_status: status.workflow.status,
    agents_count: status.workflow.agents.length,
    timestamp: new Date().toISOString()
  });
});
```

### 配置阿里云监控

1. 访问：**https://cms.console.aliyun.com**
2. 创建监控项：
   - CPU 使用率 > 80%
   - 内存使用率 > 80%
   - 磁盘使用率 > 90%
3. 设置告警通知（短信/邮件）

---

## 🔄 工作流集成示例

### 电商选品流程

```javascript
// 在你的电商系统中调用
async function selectProducts(criteria) {
  const orchestrator = new Orchestrator({
    use_real_agent: true,
    quality_threshold: 0.7
  });
  
  const result = await orchestrator.startWorkflow({
    type: 'product_selection',
    category: criteria.category,
    target_market: criteria.market,
    min_profit: criteria.minProfit,
    max_competition: criteria.maxCompetition
  });
  
  // 获取各阶段结果
  const context = orchestrator.context;
  const selection = context.getSharedData('stage_1_result');
  const risk_assessment = context.getSharedData('stage_2_result');
  const design = context.getSharedData('stage_3_result');
  
  return {
    workflow_id: result.workflow_id,
    product: selection,
    risk: risk_assessment,
    marketing: design
  };
}

// 使用
const products = await selectProducts({
  category: '智能穿戴',
  market: '北美',
  minProfit: 0.25,
  maxCompetition: '中'
});

console.log('选品结果:', products);
```

### 批量选品

```javascript
async function batchSelectProducts(categories) {
  const results = [];
  
  for (const category of categories) {
    try {
      const result = await selectProducts({
        category,
        market: '北美',
        minProfit: 0.25
      });
      results.push(result);
    } catch (error) {
      console.error(`选品失败 ${category}:`, error);
    }
  }
  
  return results;
}

// 批量处理
const categories = ['智能穿戴', '家居用品', '运动户外'];
const allResults = await batchSelectProducts(categories);
```

---

## 📁 目录结构（生产环境）

```
/root/
├── multi-agent-system/          # 多 Agent 系统
│   ├── bin/
│   ├── src/
│   ├── ecosystem.config.js      # PM2 配置
│   ├── .env                     # 环境变量
│   └── package.json
│
├── my-project/                  # 你的电商主系统
│   ├── app.js
│   ├── routes/
│   ├── services/
│   │   └── agent-service.js     # Agent 服务封装
│   └── ...
│
└── logs/                        # 日志目录
    ├── multi-agent/
    └── my-project/
```

---

## 🔐 安全配置

### 1. 限制 API 访问

```javascript
// 添加 API 密钥验证
const API_KEY = process.env.API_KEY;

app.use((req, res, next) => {
  const key = req.headers['x-api-key'];
  if (key !== API_KEY) {
    return res.status(401).json({ error: '未授权' });
  }
  next();
});
```

### 2. 配置防火墙

```bash
# 只允许内网访问 Agent 系统
sudo ufw allow from 10.0.0.0/8 to any port 3001
sudo ufw deny 3001  # 拒绝外网访问
```

### 3. 日志脱敏

```javascript
// 敏感信息脱敏
function sanitizeLog(data) {
  const sanitized = { ...data };
  if (sanitized.api_key) sanitized.api_key = '***';
  if (sanitized.password) sanitized.password = '***';
  return sanitized;
}
```

---

## 🧪 测试

### 本地测试

```bash
# 模拟模式测试
npm run test:integration

# 真实 Agent 测试
npm run test:integration:real
```

### 服务器测试

```bash
# SSH 登录服务器
ssh root@你的服务器 IP

# 测试 API
curl http://localhost:3001/health

# 提交测试任务
curl -X POST http://localhost:3001/api/workflow \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{"task":{"type":"product_selection","category":"电子产品"}}'
```

---

## 📞 故障排查

### 问题 1：Agent 执行失败

```bash
# 查看日志
pm2 logs multi-agent-system --lines 100

# 检查 OpenClaw 配置
openclaw status

# 重启服务
pm2 restart multi-agent-system
```

### 问题 2：质量门禁持续失败

```javascript
// 调整质量阈值
orchestrator.config.quality_threshold = 0.5;  // 降低要求

// 或增加重试次数
orchestrator.config.max_retries = 5;
```

### 问题 3：内存泄漏

```bash
# 查看内存使用
pm2 monit

# 如果内存持续增长，重启服务
pm2 restart multi-agent-system

# 或配置自动重启
# 在 ecosystem.config.js 中添加：
max_memory_restart: '500M'
```

---

## 📈 性能优化

### 1. 并发执行

```javascript
// 并行处理多个任务
const tasks = categories.map(cat => 
  orchestrator.startWorkflow({ category: cat })
);
const results = await Promise.all(tasks);
```

### 2. 结果缓存

```javascript
const NodeCache = require('node-cache');
const cache = new NodeCache({ stdTTL: 3600 });

async function getCachedResult(key, task) {
  let result = cache.get(key);
  if (!result) {
    result = await orchestrator.startWorkflow(task);
    cache.set(key, result);
  }
  return result;
}
```

### 3. 数据库持久化

```javascript
// 将结果保存到数据库
const MongoClient = require('mongodb').MongoClient;

async function saveResult(result) {
  const client = await MongoClient.connect('mongodb://localhost:27017');
  const db = client.db('multi-agent');
  await db.collection('workflows').insertOne({
    ...result,
    created_at: new Date()
  });
}
```

---

## ✅ 集成检查清单

- [ ] 代码已上传到服务器
- [ ] 依赖已安装
- [ ] 环境变量已配置
- [ ] PM2 已配置并启动
- [ ] API 端点可访问
- [ ] 健康检查正常
- [ ] 日志正常输出
- [ ] 监控告警已配置
- [ ] 备份策略已实施

---

## 📚 相关文档

- [README.md](./README.md) - 项目说明
- [Orchestrator.js](./src/orchestrator/Orchestrator.js) - 协调者实现
- [SharedContext.js](./src/shared-context/SharedContext.js) - 共享上下文实现

---

**集成完成后，你的跨境电商系统将拥有智能的多 Agent 协作能力！** 🎉
