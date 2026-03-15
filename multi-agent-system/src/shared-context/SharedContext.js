/**
 * SharedContext - 共享上下文
 * 
 * 功能：
 * 1. 存储所有 Agent 的状态
 * 2. 追踪工作流进度
 * 3. 传递任务包 (TaskPacket)
 * 4. 广播事件给所有 Agent
 * 5. 持久化状态（可选）
 */

const fs = require('fs');
const path = require('path');

class SharedContext {
  constructor(options = {}) {
    // 状态存储
    this.state = {
      // 当前工作流
      workflow_id: null,
      workflow_status: 'idle', // idle, running, paused, completed, failed
      current_stage: 0,
      total_stages: 0,
      started_at: null,
      completed_at: null,
      
      // Agent 状态
      agents: {},
      
      // 任务包历史
      task_packets: [],
      
      // 质量门禁记录
      quality_gates: [],
      
      // 事件日志
      events: [],
      
      // 共享数据
      shared_data: {}
    };
    
    // 配置
    this.config = {
      persist: options.persist || false,
      persist_path: options.persist_path || './shared-context-state.json',
      max_events: options.max_events || 1000,
      max_task_packets: options.max_task_packets || 100
    };
    
    // 事件监听器
    this.listeners = new Map();
    
    // 加载持久化的状态（如果启用）
    if (this.config.persist) {
      this.loadState();
    }
    
    console.log('[SharedContext] 初始化完成');
  }
  
  // ==================== 工作流管理 ====================
  
  /**
   * 启动新工作流
   */
  startWorkflow(workflow_id, total_stages, metadata = {}) {
    this.state.workflow_id = workflow_id;
    this.state.workflow_status = 'running';
    this.state.current_stage = 1;
    this.state.total_stages = total_stages;
    this.state.started_at = new Date().toISOString();
    this.state.completed_at = null;
    this.state.shared_data = { ...metadata };
    
    this.broadcast('workflow_started', {
      workflow_id,
      total_stages,
      started_at: this.state.started_at
    });
    
    this.persistState();
    
    console.log(`[SharedContext] 工作流启动：${workflow_id}`);
    return this.getWorkflowStatus();
  }
  
  /**
   * 完成工作流
   */
  completeWorkflow(result = {}) {
    this.state.workflow_status = 'completed';
    this.state.completed_at = new Date().toISOString();
    this.state.shared_data.final_result = result;
    
    this.broadcast('workflow_completed', {
      workflow_id: this.state.workflow_id,
      result,
      completed_at: this.state.completed_at
    });
    
    this.persistState();
    
    console.log(`[SharedContext] 工作流完成：${this.state.workflow_id}`);
    return this.getWorkflowStatus();
  }
  
  /**
   * 失败工作流
   */
  failWorkflow(error) {
    this.state.workflow_status = 'failed';
    this.state.completed_at = new Date().toISOString();
    this.state.shared_data.error = error;
    
    this.broadcast('workflow_failed', {
      workflow_id: this.state.workflow_id,
      error,
      completed_at: this.state.completed_at
    });
    
    this.persistState();
    
    console.log(`[SharedContext] 工作流失败：${this.state.workflow_id}`);
    return this.getWorkflowStatus();
  }
  
  /**
   * 推进到下一阶段
   */
  nextStage() {
    this.state.current_stage++;
    
    if (this.state.current_stage > this.state.total_stages) {
      return this.completeWorkflow();
    }
    
    this.broadcast('stage_changed', {
      workflow_id: this.state.workflow_id,
      current_stage: this.state.current_stage,
      total_stages: this.state.total_stages
    });
    
    this.persistState();
    
    return this.state.current_stage;
  }
  
  /**
   * 获取工作流状态
   */
  getWorkflowStatus() {
    return {
      workflow_id: this.state.workflow_id,
      status: this.state.workflow_status,
      current_stage: this.state.current_stage,
      total_stages: this.state.total_stages,
      progress: `${Math.round((this.state.current_stage / this.state.total_stages) * 100)}%`,
      started_at: this.state.started_at,
      completed_at: this.state.completed_at,
      agents: this.getAgentsStatus(),
      shared_data: this.state.shared_data
    };
  }
  
  // ==================== Agent 状态管理 ====================
  
  /**
   * 注册 Agent
   */
  registerAgent(agent_id, role, metadata = {}) {
    this.state.agents[agent_id] = {
      agent_id,
      role,
      status: 'idle', // idle, busy, error, offline
      registered_at: new Date().toISOString(),
      last_heartbeat: new Date().toISOString(),
      current_task: null,
      tasks_completed: 0,
      tasks_failed: 0,
      metadata
    };
    
    this.broadcast('agent_registered', {
      agent_id,
      role,
      status: 'idle'
    });
    
    this.persistState();
    
    console.log(`[SharedContext] Agent 注册：${agent_id} (${role})`);
    return this.state.agents[agent_id];
  }
  
  /**
   * 更新 Agent 状态
   */
  updateAgentStatus(agent_id, status, task_data = null) {
    if (!this.state.agents[agent_id]) {
      throw new Error(`Agent 未注册：${agent_id}`);
    }
    
    const agent = this.state.agents[agent_id];
    agent.status = status;
    agent.last_heartbeat = new Date().toISOString();
    agent.current_task = task_data;
    
    if (status === 'idle' && task_data === null) {
      agent.tasks_completed++;
    }
    
    this.broadcast('agent_status_update', {
      agent_id,
      status,
      current_task: task_data
    });
    
    this.persistState();
    
    return agent;
  }
  
  /**
   * Agent 心跳
   */
  heartbeat(agent_id) {
    if (this.state.agents[agent_id]) {
      this.state.agents[agent_id].last_heartbeat = new Date().toISOString();
    }
  }
  
  /**
   * 获取所有 Agent 状态
   */
  getAgentsStatus() {
    return Object.values(this.state.agents).map(agent => ({
      agent_id: agent.agent_id,
      role: agent.role,
      status: agent.status,
      uptime: Date.now() - new Date(agent.registered_at).getTime(),
      last_seen: agent.last_heartbeat,
      tasks_completed: agent.tasks_completed,
      tasks_failed: agent.tasks_failed
    }));
  }
  
  /**
   * 获取团队概览
   */
  getTeamOverview() {
    const agents = Object.values(this.state.agents);
    return {
      total: agents.length,
      active: agents.filter(a => a.status === 'busy').length,
      idle: agents.filter(a => a.status === 'idle').length,
      error: agents.filter(a => a.status === 'error').length,
      offline: agents.filter(a => a.status === 'offline').length
    };
  }
  
  // ==================== 任务包管理 ====================
  
  /**
   * 添加任务包
   */
  addTaskPacket(task_packet) {
    const packet = {
      id: task_packet.id || `task_${Date.now()}`,
      workflow_id: task_packet.workflow_id || this.state.workflow_id,
      stage: task_packet.stage,
      agent_id: task_packet.agent_id,
      status: task_packet.status || 'pending', // pending, processing, completed, failed
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      input: task_packet.input,
      output: task_packet.output || null,
      error: task_packet.error || null,
      retry_count: task_packet.retry_count || 0,
      quality_score: task_packet.quality_score || null
    };
    
    this.state.task_packets.push(packet);
    
    // 限制历史记录数量
    if (this.state.task_packets.length > this.config.max_task_packets) {
      this.state.task_packets.shift();
    }
    
    this.broadcast('task_packet_added', {
      task_id: packet.id,
      stage: packet.stage,
      agent_id: packet.agent_id
    });
    
    this.persistState();
    
    return packet;
  }
  
  /**
   * 更新任务包状态
   */
  updateTaskPacket(task_id, updates) {
    const packet = this.state.task_packets.find(p => p.id === task_id);
    if (!packet) {
      throw new Error(`任务包不存在：${task_id}`);
    }
    
    Object.assign(packet, updates, { updated_at: new Date().toISOString() });
    
    this.broadcast('task_packet_updated', {
      task_id,
      status: packet.status
    });
    
    this.persistState();
    
    return packet;
  }
  
  /**
   * 获取任务包历史
   */
  getTaskPacketHistory(limit = 10) {
    return this.state.task_packets.slice(-limit);
  }
  
  // ==================== 质量门禁 ====================
  
  /**
   * 记录质量门禁结果
   */
  recordQualityGate(stage, passed, score, details = {}) {
    const record = {
      workflow_id: this.state.workflow_id,
      stage,
      passed,
      score,
      details,
      recorded_at: new Date().toISOString()
    };
    
    this.state.quality_gates.push(record);
    
    this.broadcast('quality_gate_checked', {
      stage,
      passed,
      score
    });
    
    this.persistState();
    
    return record;
  }
  
  // ==================== 共享数据 ====================
  
  /**
   * 设置共享数据
   */
  setSharedData(key, value) {
    this.state.shared_data[key] = value;
    
    this.broadcast('shared_data_updated', {
      key,
      value
    });
    
    this.persistState();
  }
  
  /**
   * 获取共享数据
   */
  getSharedData(key = null) {
    if (key === null) {
      return { ...this.state.shared_data };
    }
    return this.state.shared_data[key];
  }
  
  // ==================== 事件系统 ====================
  
  /**
   * 广播事件
   */
  broadcast(event, data) {
    const event_record = {
      event,
      data,
      timestamp: new Date().toISOString()
    };
    
    // 记录事件
    this.state.events.push(event_record);
    
    // 限制事件数量
    if (this.state.events.length > this.config.max_events) {
      this.state.events.shift();
    }
    
    // 通知监听器
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach(callback => {
        try {
          callback(data, event_record);
        } catch (error) {
          console.error(`[SharedContext] 事件监听器错误：${error.message}`);
        }
      });
    }
    
    // 通用监听器
    if (this.listeners.has('*')) {
      this.listeners.get('*').forEach(callback => {
        try {
          callback(event, data, event_record);
        } catch (error) {
          console.error(`[SharedContext] 事件监听器错误：${error.message}`);
        }
      });
    }
  }
  
  /**
   * 监听事件
   */
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
    
    return () => this.off(event, callback);
  }
  
  /**
   * 取消监听
   */
  off(event, callback) {
    if (this.listeners.has(event)) {
      const callbacks = this.listeners.get(event);
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }
  }
  
  // ==================== 持久化 ====================
  
  /**
   * 持久化状态
   */
  persistState() {
    if (!this.config.persist) return;
    
    try {
      const state_to_save = {
        ...this.state,
        // 不保存监听器
        listeners: undefined
      };
      
      fs.writeFileSync(
        this.config.persist_path,
        JSON.stringify(state_to_save, null, 2),
        'utf8'
      );
    } catch (error) {
      console.error(`[SharedContext] 持久化失败：${error.message}`);
    }
  }
  
  /**
   * 加载状态
   */
  loadState() {
    try {
      if (fs.existsSync(this.config.persist_path)) {
        const saved_state = JSON.parse(
          fs.readFileSync(this.config.persist_path, 'utf8')
        );
        
        this.state = {
          ...this.state,
          ...saved_state,
          // 恢复时重置状态
          workflow_status: saved_state.workflow_status === 'running' ? 'paused' : saved_state.workflow_status
        };
        
        console.log(`[SharedContext] 已加载持久化状态：${this.config.persist_path}`);
      }
    } catch (error) {
      console.error(`[SharedContext] 加载状态失败：${error.message}`);
    }
  }
  
  // ==================== 工具方法 ====================
  
  /**
   * 获取完整状态（用于调试）
   */
  getFullState() {
    return JSON.parse(JSON.stringify(this.state));
  }
  
  /**
   * 重置状态
   */
  reset() {
    this.state = {
      workflow_id: null,
      workflow_status: 'idle',
      current_stage: 0,
      total_stages: 0,
      started_at: null,
      completed_at: null,
      agents: {},
      task_packets: [],
      quality_gates: [],
      events: [],
      shared_data: {}
    };
    
    this.broadcast('context_reset', {});
    this.persistState();
    
    console.log('[SharedContext] 状态已重置');
  }
}

module.exports = SharedContext;
