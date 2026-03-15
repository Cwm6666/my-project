/**
 * Orchestrator - 协调者 Agent
 * 
 * 功能：
 * 1. 接收用户任务并分解
 * 2. 分配任务给合适的 Agent
 * 3. 监控所有 Agent 状态
 * 4. 处理异常和重试
 * 5. 汇总最终结果
 * 
 * 依赖：
 * - SharedContext: 共享状态
 * - Agent Roles: 角色配置
 */

const SharedContext = require('../shared-context/SharedContext');
const { generateSystemPrompt, getRoleDetails, getAvailableRoles } = require('../roles/agent-roles');
const OpenClawAdapter = require('../runtime/OpenClawAdapter');

class Orchestrator {
  constructor(options = {}) {
    // 创建或接收共享上下文
    this.context = options.context || new SharedContext({
      persist: options.persist || false,
      max_events: options.max_events || 1000
    });
    
    // 创建 OpenClaw 适配器（用于真实 Agent 执行）
    this.adapter = options.use_real_agent ? new OpenClawAdapter({
      timeout_ms: options.timeout_ms || 300000,
      workspace: options.workspace
    }) : null;
    
    // 配置
    this.config = {
      max_retries: options.max_retries || 3,
      quality_threshold: options.quality_threshold || 0.6,
      timeout_ms: options.timeout_ms || 300000, // 5 分钟
      auto_start: options.auto_start || false,
      use_real_agent: options.use_real_agent || false
    };
    
    // 工作流定义
    this.workflow_stages = [
      { stage: 1, role: 'product_selector', name: '选品' },
      { stage: 2, role: 'risk_controller', name: '风控' },
      { stage: 3, role: 'designer', name: '设计' }
    ];
    
    // 活跃的 Agent 会话
    this.active_agents = new Map();
    
    // 事件监听
    this.setupEventListeners();
    
    console.log('[Orchestrator] 初始化完成');
    console.log(`[Orchestrator] 配置：最大重试=${this.config.max_retries}, 质量阈值=${this.config.quality_threshold}`);
  }
  
  // ==================== 事件监听 ====================
  
  setupEventListeners() {
    // 监听 Agent 状态变化
    this.context.on('agent_status_update', (data) => {
      console.log(`[Orchestrator] Agent 状态更新：${data.agent_id} -> ${data.status}`);
      this.handleAgentStatusUpdate(data);
    });
    
    // 监听任务包更新
    this.context.on('task_packet_updated', (data) => {
      console.log(`[Orchestrator] 任务包更新：${data.task_id} -> ${data.status}`);
      this.handleTaskPacketUpdate(data);
    });
    
    // 监听质量门禁
    this.context.on('quality_gate_checked', (data) => {
      console.log(`[Orchestrator] 质量门禁：阶段${data.stage} -> ${data.passed ? '通过' : '失败'} (${data.score})`);
      this.handleQualityGate(data);
    });
  }
  
  // ==================== 工作流管理 ====================
  
  /**
   * 启动新工作流
   */
  async startWorkflow(user_task) {
    const workflow_id = `wf_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    console.log(`\n[Orchestrator] 启动新工作流：${workflow_id}`);
    console.log(`[Orchestrator] 用户任务：${JSON.stringify(user_task)}`);
    
    // 初始化工作流
    this.context.startWorkflow(workflow_id, this.workflow_stages.length, {
      user_task,
      created_at: new Date().toISOString()
    });
    
    // 注册所有需要的 Agent
    await this.registerAllAgents();
    
    // 启动第一阶段
    try {
      await this.executeStage(1, user_task);
      return {
        success: true,
        workflow_id,
        status: 'running',
        message: '工作流已启动'
      };
    } catch (error) {
      console.error(`[Orchestrator] 启动失败：${error.message}`);
      this.context.failWorkflow({
        stage: 'startup',
        error: error.message
      });
      return {
        success: false,
        workflow_id,
        status: 'failed',
        error: error.message
      };
    }
  }
  
  /**
   * 执行阶段
   */
  async executeStage(stage_num, input_data) {
    const stage_config = this.workflow_stages.find(s => s.stage === stage_num);
    
    if (!stage_config) {
      throw new Error(`未知阶段：${stage_num}`);
    }
    
    console.log(`\n[Orchestrator] 执行阶段 ${stage_num}/${this.workflow_stages.length}: ${stage_config.name}`);
    
    const role = stage_config.role;
    const agent_id = this.getAgentForRole(role);
    
    if (!agent_id) {
      throw new Error(`没有可用的 ${role} Agent`);
    }
    
    // 创建任务包
    const task_packet = this.context.addTaskPacket({
      stage: stage_num,
      agent_id,
      status: 'pending',
      input: input_data
    });
    
    // 更新 Agent 状态
    this.context.updateAgentStatus(agent_id, 'busy', {
      task: stage_config.name,
      stage: stage_num,
      task_id: task_packet.id
    });
    
    // 生成角色化的 System Prompt
    const system_prompt = generateSystemPrompt(role, {
      type: `${stage_config.name}_task`,
      stage: stage_num,
      input: input_data,
      task_id: task_packet.id
    }, {
      workflow_id: this.context.state.workflow_id,
      current_stage: stage_num,
      total_stages: this.workflow_stages.length,
      team_status: this.context.getTeamOverview(),
      previous_results: this.getPreviousResults(stage_num)
    });
    
    console.log(`[Orchestrator] 任务已分配给 ${agent_id} (${role})`);
    
    // 执行 Agent 任务（这里模拟，实际使用时调用 sessions_spawn）
    const result = await this.executeAgentTask(agent_id, role, system_prompt, task_packet);
    
    return result;
  }
  
  /**
   * 执行 Agent 任务
   */
  async executeAgentTask(agent_id, role, system_prompt, task_packet) {
    console.log(`[Orchestrator] 执行 Agent 任务：${agent_id}`);
    
    // 更新任务状态为处理中
    this.context.updateTaskPacket(task_packet.id, {
      status: 'processing',
      started_at: new Date().toISOString()
    });
    
    try {
      let result;
      
      // 判断是否使用真实 Agent 执行
      if (this.config.use_real_agent && this.adapter) {
        // ===== 真实 Agent 执行 =====
        console.log(`[Orchestrator] 使用真实 Agent 执行：${role}`);
        
        const adapter_result = await this.adapter.executeAgent(role, system_prompt, {
          label: `workflow_${this.context.state.workflow_id}_stage_${task_packet.stage}`
        });
        
        if (!adapter_result.success) {
          throw new Error(adapter_result.error || 'Agent 执行失败');
        }
        
        result = adapter_result.result;
        
        console.log(`[Orchestrator] Agent 执行完成，结果：${JSON.stringify(result).substring(0, 100)}...`);
        
      } else {
        // ===== 模拟执行（测试用）=====
        console.log(`[Orchestrator] 使用模拟执行：${role}`);
        
        // 模拟 Agent 执行（延迟 1-3 秒）
        await this.sleep(1000 + Math.random() * 2000);
        
        // 模拟结果
        result = this.generateMockResult(role, task_packet.input);
      }
      
      // 更新任务状态为完成
      this.context.updateTaskPacket(task_packet.id, {
        status: 'completed',
        output: result,
        completed_at: new Date().toISOString()
      });
      
      // 更新 Agent 状态为空闲
      this.context.updateAgentStatus(agent_id, 'idle', null);
      
      // 质量门禁检查
      const quality_score = result.quality_score || 0.8;
      const passed = quality_score >= this.config.quality_threshold;
      
      this.context.recordQualityGate(
        task_packet.stage,
        passed,
        quality_score,
        { agent_id, task_id: task_packet.id }
      );
      
      if (!passed) {
        console.log(`[Orchestrator] 质量门禁失败：${quality_score} < ${this.config.quality_threshold}`);
        return await this.handleQualityFailure(task_packet, result);
      }
      
      console.log(`[Orchestrator] 阶段 ${task_packet.stage} 完成，质量评分：${quality_score}`);
      
      // 保存到共享数据
      this.context.setSharedData(`stage_${task_packet.stage}_result`, result);
      
      // 进入下一阶段
      const next_stage = this.context.nextStage();
      
      if (next_stage <= this.workflow_stages.length) {
        // 继续下一阶段
        return await this.executeStage(next_stage, result);
      } else {
        // 所有阶段完成
        return await this.completeWorkflow(result);
      }
      
    } catch (error) {
      console.error(`[Orchestrator] Agent 任务执行失败：${error.message}`);
      
      // 更新任务状态为失败
      this.context.updateTaskPacket(task_packet.id, {
        status: 'failed',
        error: error.message,
        failed_at: new Date().toISOString()
      });
      
      // 更新 Agent 状态为错误
      this.context.updateAgentStatus(agent_id, 'error', null);
      
      // 重试逻辑
      return await this.handleTaskFailure(task_packet, error);
    }
  }
  
  /**
   * 完成工作流
   */
  async completeWorkflow(final_result) {
    console.log('\n[Orchestrator] 工作流完成');
    
    const result = this.context.completeWorkflow({
      success: true,
      final_result,
      stages_completed: this.workflow_stages.length,
      completed_at: new Date().toISOString()
    });
    
    // 生成最终报告
    const report = this.generateFinalReport();
    
    return {
      success: true,
      workflow_id: this.context.state.workflow_id,
      status: 'completed',
      result: final_result,
      report
    };
  }
  
  // ==================== 失败处理 ====================
  
  /**
   * 处理质量门禁失败
   */
  async handleQualityFailure(task_packet, result) {
    const retry_count = task_packet.retry_count || 0;
    
    if (retry_count < this.config.max_retries) {
      console.log(`[Orchestrator] 质量失败，准备重试 (${retry_count + 1}/${this.config.max_retries})`);
      
      // 重试当前阶段
      this.context.updateTaskPacket(task_packet.id, {
        retry_count: retry_count + 1,
        status: 'pending'
      });
      
      // 重新执行当前阶段
      return await this.executeStage(task_packet.stage, task_packet.input);
    } else {
      console.log(`[Orchestrator] 质量失败，已达最大重试次数`);
      
      // 升级告警
      this.context.broadcast('workflow_alert', {
        workflow_id: this.context.state.workflow_id,
        type: 'quality_failure',
        stage: task_packet.stage,
        retry_count
      });
      
      // 可以选择继续或终止
      // 这里选择继续到下一阶段（宽松模式）
      const next_stage = this.context.nextStage();
      
      if (next_stage <= this.workflow_stages.length) {
        return await this.executeStage(next_stage, result);
      } else {
        return await this.completeWorkflow(result);
      }
    }
  }
  
  /**
   * 处理任务执行失败
   */
  async handleTaskFailure(task_packet, error) {
    const retry_count = task_packet.retry_count || 0;
    
    if (retry_count < this.config.max_retries) {
      console.log(`[Orchestrator] 任务失败，准备重试 (${retry_count + 1}/${this.config.max_retries})`);
      
      // 重试当前阶段
      this.context.updateTaskPacket(task_packet.id, {
        retry_count: retry_count + 1,
        status: 'pending'
      });
      
      // 重新执行当前阶段
      return await this.executeStage(task_packet.stage, task_packet.input);
    } else {
      console.log(`[Orchestrator] 任务失败，已达最大重试次数`);
      
      // 终止工作流
      this.context.failWorkflow({
        stage: task_packet.stage,
        task_id: task_packet.id,
        error: error.message,
        retry_count
      });
      
      return {
        success: false,
        workflow_id: this.context.state.workflow_id,
        status: 'failed',
        error: error.message
      };
    }
  }
  
  // ==================== Agent 管理 ====================
  
  /**
   * 注册所有需要的 Agent
   */
  async registerAllAgents() {
    console.log('\n[Orchestrator] 注册所有 Agent');
    
    const roles = getAvailableRoles();
    
    for (const role of roles) {
      const agent_id = `agent_${role.id}_${Date.now()}`;
      
      this.context.registerAgent(agent_id, role.id, {
        role_name: role.name,
        role_description: role.description
      });
      
      this.active_agents.set(role.id, agent_id);
      
      console.log(`[Orchestrator] 已注册：${agent_id} (${role.id})`);
    }
  }
  
  /**
   * 获取角色对应的 Agent ID
   */
  getAgentForRole(role) {
    return this.active_agents.get(role);
  }
  
  /**
   * 处理 Agent 状态更新
   */
  handleAgentStatusUpdate(data) {
    // 可以在这里添加自定义逻辑
    // 例如：检测 Agent 长时间无响应
  }
  
  /**
   * 处理任务包更新
   */
  handleTaskPacketUpdate(data) {
    // 可以在这里添加自定义逻辑
    // 例如：记录任务执行时间
  }
  
  /**
   * 处理质量门禁
   */
  handleQualityGate(data) {
    // 可以在这里添加自定义逻辑
    // 例如：连续失败时触发告警
  }
  
  // ==================== 工具方法 ====================
  
  /**
   * 获取之前阶段的结果
   */
  getPreviousResults(current_stage) {
    const results = {};
    
    for (let i = 1; i < current_stage; i++) {
      const key = `stage_${i}_result`;
      const value = this.context.getSharedData(key);
      if (value) {
        results[`stage_${i}`] = value;
      }
    }
    
    return results;
  }
  
  /**
   * 生成模拟结果（测试用）
   */
  generateMockResult(role, input) {
    const mock_results = {
      product_selector: {
        product_name: '无线耳机',
        category: input.category || '电子产品',
        estimated_profit: '25%',
        data_source: '电商平台热销榜',
        recommendation_reason: '市场需求大，竞争小，利润率高',
        quality_score: 0.85
      },
      risk_controller: {
        risk_score: 0.8,
        passed: true,
        risk_factors: ['供应链稳定', '无知识产权风险'],
        suggestions: '建议批量采购',
        quality_score: 0.8
      },
      designer: {
        main_image_prompt: '白色无线耳机，简约设计，纯色背景',
        description: '高品质无线耳机，超长续航，舒适佩戴',
        marketing_copy: '🎧 沉浸式音质体验，限时特惠！',
        tags: ['电子产品', '音频', '无线'],
        quality_score: 0.9
      }
    };
    
    return mock_results[role] || { quality_score: 0.8 };
  }
  
  /**
   * 生成最终报告
   */
  generateFinalReport() {
    const workflow_status = this.context.getWorkflowStatus();
    
    return {
      workflow_id: workflow_status.workflow_id,
      status: workflow_status.status,
      progress: workflow_status.progress,
      stages: this.workflow_stages.map(s => ({
        stage: s.stage,
        name: s.name,
        role: s.role
      })),
      agents: workflow_status.agents,
      task_packets: this.context.getTaskPacketHistory(10),
      completed_at: workflow_status.completed_at
    };
  }
  
  /**
   * 休眠
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  /**
   * 获取当前状态
   */
  getStatus() {
    return {
      workflow: this.context.getWorkflowStatus(),
      active_agents: Array.from(this.active_agents.entries()),
      config: this.config
    };
  }
}

module.exports = Orchestrator;
