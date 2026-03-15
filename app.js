const express = require('express');
const app = express();
const port = 3000;

// 解析 JSON 请求体
app.use(express.json());

// 首页
app.get('/', (req, res) => {
  res.send(`
    <h1>🎉 欢迎我的服务器！</h1>
    <p>服务器运行正常</p>
    <p>时间：${new Date().toLocaleString('zh-CN')}</p>
  `);
});

// 健康检查接口
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    time: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// 自定义 API 接口
app.get('/api/hello', (req, res) => {
  res.json({ 
    message: 'Hello World!', 
    author: 'Cwm6666' 
  });
});

// 接收 POST 请求
app.post('/api/echo', (req, res) => {
  res.json({ 
    youSent: req.body,
    received: true 
  });
});

app.listen(port, () => {
  console.log(`🚀 Server running on port ${port}`);
});
