# Slurm Orbital

一个面向 Slurm 集群的 Web 控制台。集群侧运行一个轻量 agent，浏览器通过前端网关接入 agent，实时查看和操作队列、作业、节点与账户。

## 特性

- **网关式架构**：agent 主动向网关注册，无需在集群上开放入站端口
- **多后端**：一个网关可同时接入多台集群，按访问密钥隔离
- **作业管理**：队列 / 历史双视图、状态筛选、挂起 / 释放 / 取消
- **实时监控**：运行中作业的 CPU 利用率与内存峰值仪表盘，近 5 分钟 CPU 曲线
- **产物查看**：直接读取作业的 stdout / stderr（尾部 256 KB）
- **节点与账户**：节点状态变更（恢复 / 排空 / 下线）、账户树增删改
- **零依赖配置**：Tailwind v4 主题全部定义在 CSS 中，无需 `tailwind.config.js`

## 架构

```
┌──────────┐    WebSocket    ┌───────────────────┐    WebSocket    ┌──────────────┐
│ Browser  │ ──────────────► │  前端网关          │ ──────────────► │  Agent (CLI) │
│  Nuxt    │ ◄────────────── │  Nitro + Socket.IO│ ◄────────────── │  slurmjs     │
└──────────┘                 └───────────────────┘                 └──────────────┘
                                                                          │
                                                                          ▼
                                                              squeue / sinfo / sacct
                                                              scontrol / sacctmgr / sstat
```

- **前端网关**：运行在 Nuxt/Nitro 进程内的 Socket.IO 服务，负责登记 agent、维护浏览器会话、双向中继请求
- **Agent**：跑在能执行 Slurm 命令的机器（通常是登录节点），把 `slurmjs` 的调用结果回传给网关
- **认证流程**：浏览器提交访问密钥 → 网关转发给 agent 校验 → 通过后网关为该连接建立会话

## 环境要求

- **前端**：Node.js `^22.22.3`、`^24.15.0` 或 `>=26`，包管理器推荐 [Bun](https://bun.com)
- **Agent**：Node.js `>=22.12`（受 Commander 15 约束），且 `squeue`、`sbatch`、`scancel`、`sinfo`、`sacct`、`sstat`、`scontrol`、`sacctmgr` 在 `PATH` 中
- **Slurm**：已部署且当前用户有权限执行上述命令

## 快速开始

### 1. 启动前端网关

```bash
cd frontend
bun install          # postinstall 会自动执行 nuxt prepare
bun dev              # 默认 http://localhost:3000
```

### 2. 在集群侧启动 agent

```bash
cd backend
bun install
node server.js start http://<网关地址>:3000
```

启动后终端会打印本次使用的身份与访问密钥：

```
[agent] identity gpu-login01
[agent] slurm installed: true, root: false
[agent] access key 3f2c8a1e-...
```

**记下这个 access key**，回到浏览器首页填入即可进入该集群的控制台。

### 3. 常用参数

```bash
node server.js start <url> [选项]

  -n, --name <name>          后端显示名称，默认取主机名
  -p, --password <password>  固定访问密钥，默认每次启动随机生成 UUID
```

指定固定密钥便于长期使用：

```bash
node server.js start http://localhost:3000 -n gpu-cluster -p my-secret
```

## 页面

| 路径 | 说明 |
| --- | --- |
| `/` | 网关页：列出在线后端，输入访问密钥进入 |
| `/console/:id` | 集群概览：Slurm 版本、分区数、节点与作业统计、后端信息 |
| `/console/:id/jobs` | 作业列表，支持队列 / 历史切换与状态筛选 |
| `/console/:id/jobs/:jobId` | 作业详情：生命周期时间轴、资源监控、输出文件、操作按钮 |
| `/console/:id/nodes` | 节点列表，按分区分组 |
| `/console/:id/nodes/:nodeName` | 节点详情与状态变更 |
| `/console/:id/accounts` | 账户树，root 用户可增删改 |
| `/console/:id/admin` | 管理入口（Slurm 安装功能开发中） |

进入控制台后，左侧栏会根据 `slurmInstalled` 与 `isRoot` 呈现不同视图：加载中、正常控制台、安装引导（root 但未装 Slurm）、无权限提示。

## 权限说明

- **访问密钥**：决定能否进入某个后端，由 agent 侧比对
- **root 身份**：agent 以 root 运行时，前端才展示节点状态变更与账户管理入口
- **已知限制**：当前 root 判定仅在界面层生效，网关并未对写操作做服务端鉴权。请只在受信网络内部署，或为 agent 使用非 root 账号

## 项目结构

```
.
├── backend/                  # 集群侧 agent（CLI）
│   └── server.js             # 注册、认证、Slurm 事件转发
└── frontend/                 # Nuxt 4 应用
    ├── app/
    │   ├── assets/css/       # Tailwind 入口与 @theme 颜色定义
    │   ├── components/       # 业务组件
    │   │   └── ui/           # 通用组件（卡片、按钮、输入、仪表盘等）
    │   ├── composables/
    │   │   ├── useSocket.js  # 网关连接、会话与 slurm API
    │   │   └── useAction.js  # 统一的异步操作状态封装
    │   ├── layouts/          # console 布局（侧边栏 + 视图状态）
    │   ├── middleware/       # 会话校验
    │   ├── pages/            # 路由页面
    │   └── utils/format.js   # 格式化与状态着色
    ├── server/plugins/socket.io.js  # 网关：agent 登记、会话、请求中继
    └── nuxt.config.js
```

## 开发

```bash
cd frontend
bun dev          # 开发服务器
bun run build    # 生产构建
bun run lint     # 代码检查
bun run lint:fix # 自动修复
```

> ESLint 配置由 `@nuxt/eslint` 生成在 `.nuxt/` 中，因此**首次运行 lint 前必须先安装依赖**（`postinstall` 会执行 `nuxt prepare`）。若 `.nuxt` 缺失且未安装依赖，lint 会因找不到生成配置而失败。

主题色统一在 `frontend/app/assets/css/main.css` 的 `@theme` 块中维护，形如 `--color-orbit-*`，可直接使用 `bg-orbit-card`、`text-orbit-muted` 等工具类。

## 技术栈

| 层 | 选型 |
| --- | --- |
| 前端框架 | Nuxt 4.6 / Vue 3.5 |
| 样式 | Tailwind CSS 4（CSS-first 主题） |
| 实时通信 | Socket.IO 4.8 + engine.io |
| 集群交互 | [slurmjs](https://www.npmjs.com/package/slurmjs) |
| CLI 解析 | Commander 15 |
| 代码检查 | ESLint 10 + `@nuxt/eslint` |

## 路线图

- [ ] Slurm 安装与初始化引导（`/console/:id/admin`）
- [ ] 网关侧写操作鉴权
- [ ] 作业提交表单
- [ ] 多后端聚合视图

## 许可证

[Apache License 2.0](./LICENSE)
