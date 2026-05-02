# Vapor Notes

Vapor Notes 是一个跨端统一的备忘录系统，只保留两类核心记录：

- 临时待办：快速记录短期事项，即写即用。
- 长期待办：按项目组织长期事项，每个项目下包含多条备忘录。

系统由同一个 Git 仓库维护，包含 Web 端与微信小程序端，数据统一存储在微信云开发。

## 删除冗余功能清单

已删除或停用的功能：

- 链接识别、快捷链接、外部访问按钮。
- 外部内容聚合入口。
- 云端任务记录、完成状态统计、任务/链接混合分类。
- `title`、`url`、`done`、`priority`、`source`、`is_pinned` 等历史冗余写入字段。
- 本地孤岛数据和 `localStorage` 业务存储。
- 多项目副本和根目录旧 Web 入口。

处理步骤：

1. `notes` 写入逻辑改为统一字段：`content/type/project_id/created_at/updated_at`。
2. 新增 `projects` 集合承载长期待办项目。
3. 小程序与 Web 都改为 `notesService` 数据层。
4. UI 只保留临时待办、长期项目、搜索、新增、删除。
5. 历史旧字段不再被新代码写入或依赖，后续可在云数据库控制台批量清理。

## 功能结构

临时待办：

- 快速新增。
- 列表展示。
- 删除。
- 搜索内容。

长期待办：

- 创建项目。
- 选择项目。
- 在项目内新增备忘录。
- 项目内列表展示。
- 删除项目内备忘录。
- 搜索内容。

所有操作围绕最少路径设计，不做复杂层级、标签、模板或外部聚合。

## 数据模型

### notes 集合

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `_id` | string | 云数据库自动生成唯一 ID |
| `content` | string | 备忘录内容 |
| `type` | string | `temporary` 或 `longterm` |
| `project_id` | string | 长期待办所属项目，临时待办为空字符串 |
| `created_at` | string | ISO 创建时间 |
| `updated_at` | string | ISO 更新时间 |

### projects 集合

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `_id` | string | 云数据库自动生成唯一 ID |
| `name` | string | 项目名称 |
| `created_at` | string | ISO 创建时间 |

## 项目结构

```text
glass-data-recorder/
├── miniprogram/              # 微信小程序端
│   ├── app.js
│   ├── app.json
│   ├── project.config.json
│   └── pages/index/
├── web/                      # Web 端
│   ├── index.html
│   ├── app.js
│   └── styles.css
├── cloudfunctions/           # 云函数预留
├── package.json
├── .gitignore
└── README.md
```

## 小程序与 Web 重构方案

小程序端：

- `miniprogram/pages/index/index.js` 封装 `notesService`。
- 同时监听 `notes` 与 `projects` 两个集合。
- 用 `mode` 切换临时待办与长期待办。
- 长期待办必须先选中项目，再新增内容。

Web 端：

- `web/app.js` 封装同名 `notesService`。
- 页面结构与小程序一致：模式切换、搜索、统计、临时列表、项目列表、长期列表。
- 通过轮询实现准实时同步。

## 数据同步逻辑

统一数据流：

```text
Web / 小程序
  -> notesService.createNote / createProject / removeNote
  -> 微信云开发 notes / projects
  -> 小程序 watch 实时监听
  -> Web 轮询准实时同步
```

小程序：

- `notes` 集合使用 `watch`。
- `projects` 集合使用 `watch`。
- 任意集合监听失败后，3 秒后重新加载并重建监听。

Web：

- `refreshAll()` 同时读取 `notes` 与 `projects`。
- 每 4 秒轮询一次。
- 新增、删除后立即刷新一次。

## 核心代码示例

新增临时待办：

```js
notesService.createNote(content, 'temporary', '');
```

新建长期项目：

```js
db.collection('projects').add({
  data: {
    name,
    created_at: new Date().toISOString(),
  },
});
```

新增项目内备忘录：

```js
notesService.createNote(content, 'longterm', selectedProjectId);
```

统一写入模型：

```js
{
  content,
  type,
  project_id: projectId || '',
  created_at: now,
  updated_at: now
}
```

## 运行方式

Web：

```bash
npm install
npm start
```

小程序：

```text
微信开发者工具导入：
/Users/xupengfei/Documents/glass-data-recorder/miniprogram
```

云环境 ID：

```js
const CLOUD_ENV = 'cloud1-d8gzx0xvwbed1f1f4';
```

小程序 AppID：

```json
"appid": "wx625829c0333a4cb2"
```

## Git 单一数据源

本项目采用一个本地目录、一个 Git 仓库、一个 GitHub 远程仓库：

```text
/Users/xupengfei/Documents/glass-data-recorder
https://github.com/Vapor-Byy/glass-data-recorder.git
```

VSCode 打开仓库根目录，微信开发者工具导入同一仓库下的 `miniprogram/`。

提交流程：

```bash
git status
git add .
git commit -m "refactor vapor notes focus"
git push origin main
```

其他设备同步：

```bash
git pull origin main
```
