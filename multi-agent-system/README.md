# 🎭 多 Agent 协作系统

**跨境电商多 Agent 融合系统 - 角色认知 + 共享上下文 + 协调调度**

---

## 🚀 快速开始

### 安装依赖

```bash
cd multi-agent-system
npm install
```

### 运行测试

```bash
# 运行所有测试
npm run test:all

# 运行集成测试（模拟模式）
npm run test:integration

# 运行集成测试（真实 Agent 模式）
npm run test:integration:real
```

### 启动系统

```bash
# 模拟模式（快速测试）
npm start

# 真实 Agent 模式
npm run start:real

# 自定义任务
node bin/start.js --task "选品：电子产品，目标市场：北美"
```

---

## 📋 系统架构

```
┌─────────────────────────────────────────────────────────────┐
│                    协调者 Agent (Orchestrator)               │
│  - 接收用户任务                                              │
│  - 分配任务给子 Agent                                        │
│  - 监控执行进度                                              │
│  - 处理异常和重试                                            │
└─────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
        ▼                     ▼                     ▼
┌───────────────┐   ┌───────────────┐   ┌───────────────┐
│  选品 Agent   │   │  风控 Agent   │   │  设计 Agent   │
│  (product_    │   │  (risk_       │   │  (designer)   │
│   selector)   │   │   controller) │   │               │
└───────────────┘   └───────────────┘   └───────────────┘
        │                     │                     │
        └─────────────────────┼─────────────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │  SharedContext  │
                    │  (共享状态存储)  │
                    └─────────────────┘
```

---

## 🎯 核心功能

### Phase A: 角色化 System Prompt

每个 Agent 启动时注入角色信息，让它知道：
- ✅ 自己的身份和职责
- ✅ 约束条件
- ✅ 团队中有哪些队友
- ✅ 工作流程是怎样的

**文件：** `src/roles/agent-roles.js`

### Phase B: 共享上下文 (SharedContext)

所有 Agent 共享同一个状态存储：
- ✅ Agent 状态追踪
- ✅ 工作流进度追踪
- ✅ 任务包传递
- ✅ 质量门禁记录
- ✅ 事件广播和监听

**文件：** `src/shared-context/SharedContext.js`

### Phase C: 协调者 Agent (Orchestrator)

中央协调机制：
- ✅ 任务分解和分配
- ✅ 执行监控
- ✅ 失败重试
- ✅ 结果汇总

**文件：** `src/orchestrator/Orchestrator.js`

### Phase D: OpenClaw 运行时适配器

集成真实 Agent 执行：
- ✅ 调用 `sessions_spawn` 执行真实 Agent
- ✅ 等待结果返回
- ✅ 超时和错误处理

**文件：** `src/runtime/OpenClawAdapter.js`

---

## 📁 项目结构

```
multi-agent-system/
├── bin/
│   └── start.js                  # 命令行启动脚本
├── src/
│   ├── roles/
│   │   ├── agent-roles.js        # 角色配置
│   │   └── test-roles.js         # 角色测试
│   ├── shared-context/
│   │   ├── SharedContext.js      # 共享上下文
│   │   └── test-shared-context.js
│   ├── orchestrator/
│   │   ├── Orchestrator.js       # 协调者
│   │   ├── test-orchestrator.js
│   │   └── test-integration.js   # 集成测试
│   └── runtime/
│       └── OpenClawAdapter.js    # OpenClaw 适配器
├── package.json
└── README.md
```

---

## 🔧 配置选项

### Orchestrator 配置

```javascript
const orchestrator = new Orchestrator({
  max_retries: 3,              // 最大重试次数
  quality_threshold: 0.6,      // 质量门禁阈值
  timeout_ms: 300000,          // 超时时间（5 分钟）
  use_real_agent: false,       // 是否使用真实 Agent
  workspace: './workspace'     // OpenClaw 工作目录
});
```

### SharedContext 配置

```javascript
const context = new SharedContext({
  persist: false,              // 是否持久化状态
  persist_path: './state.json',
  max_events: 1000,            // 最大事件记录数
  max_task_packets: 100        // 最大任务包记录数
});
```

---

## 📊 工作流示例

### 输入任务

```json
{
  "type": "product_launch",
  "category": "智能穿戴",
  "target_market": "北美",
  "budget": 15000,
  "timeline": "3 周"
}
```

### 执行流程

```
阶段 1: 选品 Agent
  ↓ 质量门禁 (0.85 ≥ 0.6) ✅
阶段 2: 风控 Agent
  ↓ 质量门禁 (0.80 ≥ 0.6) ✅
阶段 3: 设计 Agent
  ↓ 质量门禁 (0.90 ≥ 0.6) ✅
完成
```

### 输出结果

```json
{
  "success": true,
  "workflow_id": "wf_xxx",
  "status": "completed",
  "result": {
    "product_name": "无线耳机",
    "risk_score": 0.8,
    "design_assets": {...}
  }
}
```

---

## 🧪 测试命令

```bash
# 测试角色配置
npm run test:roles

# 测试共享上下文
npm run test:context

# 测试协调者
npm run test:orchestrator

# 集成测试（模拟）
npm run test:integration

# 集成测试（真实 Agent）
npm run test:integration:real

# 运行所有测试
npm run test:all
```

---

## 🚀 部署到服务器

### 1. 上传代码

```bash
# 在服务器上
cd ~
git clone https://github.com/Cwm6666/my-project.git
cd my-project/multi-agent-system
npm install --production
```

### 2. 配置环境变量

```bash
# 设置 OpenClaw 工作目录
export OPENCLAW_WORKSPACE=/root/.openclaw/workspace
```

### 3. 使用 PM2 运行

```bash
# 启动应用
pm2 start npm --name "multi-agent" -- start

# 保存配置
pm2 save
```

---

## 📝 使用示例

### 示例 1：基本使用

```javascript
const Orchestrator = require('./src/orchestrator/Orchestrator');

const orchestrator = new Orchestrator({
  use_real_agent: false  // 模拟模式
});

const result = await orchestrator.startWorkflow({
  type: 'product_launch',
  category: '电子产品'
});

console.log(result);
```

### 示例 2：自定义工作流

```javascript
const orchestrator = new Orchestrator({
  quality_threshold: 0.8,  // 更高质量要求
  max_retries: 5           // 更多重试次数
});

orchestrator.workflow_stages = [
  { stage: 1, role: 'product_selector', name: '选品' },
  { stage: 2, role: 'risk_controller', name: '风控' },
  { stage: 3, role: 'designer', name: '设计' },
  { stage: 4, role: 'marketing', name: '营销' }  // 自定义阶段
];

const result = await orchestrator.startWorkflow(task);
```

### 示例 3：监听事件

```javascript
const context = new SharedContext();

context.on('workflow_completed', (data) => {
  console.log('工作流完成:', data.workflow_id);
});

context.on('quality_gate_checked', (data) => {
  if (!data.passed) {
    console.log('质量门禁失败:', data.stage);
  }
});
```

---

## 🎯 扩展指南

### 添加新 Agent 角色

1. 在 `src/roles/agent-roles.js` 中添加角色配置
2. 在 `Orchestrator` 的 `workflow_stages` 中添加阶段
3. 实现对应的 Agent 执行逻辑

### 自定义质量门禁

```javascript
orchestrator.config.quality_threshold = 0.9;

// 或自定义质量检查逻辑
orchestrator.checkQuality = async (result) => {
  // 自定义检查逻辑
  return score >= 0.8;
};
```

### 添加持久化

```javascript
const context = new SharedContext({
  persist: true,
  persist_path: './workflow-state.json'
});
```

---

## 📞 支持

- **GitHub:** https://github.com/Cwm6666/my-project
- **问题反馈:** 提交 Issue

---

## 📄 许可证

MIT License
