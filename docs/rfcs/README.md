# xinsight RFC 工作流指南

> RFC (Request for Comments) 是一种“提议与意见征集”的工程文化和文档工作流。它最初源于互联网工程任务组 (IETF) 制定的互联网标准（如 HTTP、TCP/IP 协议规范），后来被广泛应用于现代软件工程（如 Rust, React, Vue, Ember 等开源社区，以及 Google, Uber 等科技公司）中，用于**在编写代码之前，对重大功能、架构重构或产品需求进行深入的讨论和共识对齐。**

## 1. 为什么使用 RFC？

- **谋定而后动**：强制开发者在写代码前先思考架构、API 设计和边界情况（Edge Cases）。
- **Docs as Code**：文档与代码同源管理，享受 Git 的版本控制、Diff 和 Code Review 机制。
- **异步协作与追溯**：所有的架构决策、权衡讨论（Trade-offs）都会沉淀在 PR 的评论区和最终的文档中，新加入的成员可以追溯“为什么当初这样设计”。
- **文档不滞后**：一旦 RFC 被合并，它就成为了指导后续开发的基准（Baseline）。代码与文档的修改将同步进行。

## 2. 什么样的改动需要 RFC？

不是所有的 PR 都需要写 RFC。**以下情况需要：**

- 重大的架构重构（如：状态管理方案切换、引入新的核心库，例如 #206 Agent 架构重构）。
- 涉及跨模块 API 的修改。
- 引入新的产品核心功能（需要完整的 PRD 支撑）。
- 改变系统原有的行为或数据模型。

**以下情况不需要：**

- 修复 Bug（Bugfix）。
- 简单的 UI 样式微调。
- 不影响外部接口的内部函数重构。
- 补充测试用例。

## 3. RFC 标准工作流

在 `xinsight` 项目中，执行 RFC 的标准流程如下：

### 阶段 1：提出设想（Ideation）

在 GitHub Issue 中提出初步想法，确认该方向是有价值的，避免写了很长的文档却被直接否决。

- 创建一个 Issue，简单描述你要解决的问题和初步方案。
- 如果讨论达成初步共识，进入阶段 2。

### 阶段 2：起草 RFC（Drafting）

- 在本地从 `main` 切出一个分支：`git checkout -b rfc/my-new-feature`。
- 在 `docs/rfcs/` 目录下新建一个 Markdown 文件。命名规范：`0000-feature-name.md`（0000 替换为下一个可用的序号）。
- 按照 PRD 或架构设计文档的模板撰写内容（必须包含：动机、详细设计、替代方案、风险等）。

### 阶段 3：发起 PR 进行审查（Review）

- 提交代码并向 `main` 发起 Pull Request。
- PR 标题格式：`RFC: [功能简述]`。
- 团队成员在 PR 中对文档进行 Review。通过 GitHub 的行内评论提出疑问、修改建议或指出设计漏洞。
- 作者根据反馈不断修改 RFC 文档，直到解决所有争议。

### 阶段 4：达成共识与合并（Accepted / Merged）

- 当团队达成共识后，该 PR 会被合并到 `main` 分支。
- **注意：合并 RFC 并不意味着代码已经实现**，而是代表“团队同意按照这份文档的设计进行开发”。这份 RFC 此时状态变为 `Accepted`。

### 阶段 5：实施（Implementation）

- 根据该 RFC，拆分出具体的工程任务（Tracking Issue 与子 Issue）。
- 开发者基于 RFC 进行编码。如果在开发过程中发现原设计行不通，需要提交一个新的 PR 来更新该 RFC 文档。
- 最终代码的 PR 描述中，应附上该 RFC 的链接。

## 4. 业界参考与资源

如果你想了解更多关于 RFC 的社区实践，可以参考以下著名的开源项目 RFC 规范：

- [Rust RFCs](https://github.com/rust-lang/rfcs): 业界最著名、最严谨的 RFC 流程之一。
- [React RFCs](https://github.com/reactjs/rfcs): React 社区用于提议新 Hooks 或新特性的流程。
- [Vue RFCs](https://github.com/vuejs/rfcs): Vue.js 框架的提案库。
- [IETF RFCs](https://www.ietf.org/standards/rfcs/): 互联网标准的起源（偏学术和标准化，不适合日常敏捷开发，但具有历史参考意义）。
