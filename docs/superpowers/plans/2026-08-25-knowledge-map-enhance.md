# 知识地图页优化实施计划（多维度视图 + 缩放交互 + 节点详情布局）

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** 优化 `apps/web/src/pages/KnowledgeMap.tsx` 知识地图页：①多维度视图（视图模式切换 + 图谱内维度重组）②缩放/操作逻辑 ③节点详情抽屉 + 整体布局。仅前端 mock 数据（mapData.ts），不动后端。

**Architecture:** 保持现有 custom SVG 图谱（`computeLayout`/`view {x,y,k}`/指针拖拽），在其上叠加：视图模式切换（图谱/列表/分类树）、维度选择器（分类/类型/状态/作者，重组节点着色与图例）、缩放交互（滚轮/双击/工具栏）、节点详情右侧 overlay 抽屉。改动集中在 `KnowledgeMap.tsx`，必要时拆出 `src/components/pages/` 或 `pages/workspace/` 下的子组件（如 `KnowledgeMapDetailDrawer`、`KnowledgeMapToolbar`）。数据沿用 `mapData.ts`（MAP_DOCS/MAP_CATEGORIES/ORPHAN_DOCS + 热点 Top3 数据）。

**Tech Stack:** React 19 · TS · Tailwind · 现有 SVG/pointer 实现 · framer-motion（抽屉）

## Global Constraints

- 中文 UI；视觉 `specs/design-system.md`；不改变现有 mock 数据集与数值口径（128 份/5 分类/156 问题/节点 asked·cited 不变）。
- 不回归现有功能：筛选（类型/状态/搜索）、导出 PNG、孤儿文档抽屉、右侧热点 Top3、demoOff 空态。
- 每任务：`npm run build --workspace @kb/web` + `npx tsc --noEmit` + `npm run lint`（根）全 0；commit；headless 渲染抽查无白屏/TypeError。
- 复用已有样式术语（BTN_PRIMARY/BTN_SECONDARY/chipCls 等）。

---

### Task 1: 多维度视图（视图模式切换 + 图谱维度重组）

**Files:**
- Modify: `apps/web/src/pages/KnowledgeMap.tsx`（视图状态/维度状态 + 对应 JSX）

**Interfaces:**
- Consumes: `MAP_DOCS/MAP_CATEGORIES/ORPHAN_DOCS`。
- Produces: `viewMode: 'graph'|'list'|'tree'` state；`dim: 'category'|'type'|'validity'|'owner'` state（图例与 re-color）；`dimGroups()` 按 dim 分组。

- [ ] **Step 1: 视图模式切换 UI**：顶部工具条加分段切换「图谱 / 列表 / 分类树」；graph 复用现有图谱；list 渲染文档列表（表格/卡片：名称/分类/状态/作者/被问/被引/版本，复用现有 color/label）；tree 渲染分类树（分类→其文档，层级缩进）。三个视图同一份 `filteredDocs`（沿用现有 type/validity/search 过滤）。
- [ ] **Step 2: 图谱内维度重组**：graph 视图顶部加维度选择器（分类/类型/状态/作者）；切换 dim 时，节点着色与图例随之变化：category→按 5 分类色；type→按节点类型（文档蓝/问题青/分类紫）；validity→按 正常/复审将到期/可能过期/存在冲突 色（异常红沿用）；owner→按作者（张伟/李娜/王强/赵敏/陈可）色。节点大小仍按 asked 数；异常红边保留（validity=存在冲突/可能过期）。
- [ ] **Step 3**: 图例按当前 dim 动态展示；维度切换时节点 `fill` 更新；过滤器与维度选择器协同（可选：选「状态=可能过期」可联动高亮）。
- [ ] **Step 4: 验证**：`tsc`/`build`/`lint` 0；headless 加载 `/workspace/knowledge-map` 无白屏，图谱/列表/树切换与维度切换渲染正常（DOM 内含对应文本分区）。
- [ ] **Step 5: Commit** `feat(web): 知识地图多维度视图（图/列表/树 + 维度重组）`

---

### Task 2: 缩放/操作逻辑优化

**Files:**
- Modify: `apps/web/src/pages/KnowledgeMap.tsx`

**Interfaces:**
- Consumes: `view {x,y,k}`、`canvasRef/svgRef`、`setView`。
- Produces: `zoomTo(k, cx, cy)`（以点为中心）、`fitView()`、`resetView()`、`wheel` 处理器、`dblclick` 处理器、`Minimap`（可选）。

- [ ] **Step 1: 滚轮缩放（以鼠标为中心）**：`onWheel`（preventDefault）→ `k' = clamp(k * (deltaY<0 ? 1.1 : 0.9), 0.2, 3)`；`zoomTo(k', e.clientX, e.clientY)` 用画布坐标换算新 `x/y`，保证光标下节点不动。
- [ ] **Step 2: 双击缩放**：`onDoubleClick` → `zoomTo(k*1.6, ...)`。
- [ ] **Step 3: 缩放工具栏**：`+ / − / 适配视口(fit) / 重置(1:1)` 按钮（在画布右上角或底部浮动条），`fitView()` 计算节点包围盒缩到视口，`resetView()` 回 `{x:0,y:0,k:1}`；当前 k 百分比显示。
- [ ] **Step 4: 平移优化**：拖拽平移边界；可选 `Minimap`（右下角小缩略图，实时节点分布 + 视口框）。
- [ ] **Step 5: 验证**：`tsc`/`build`/`lint` 0；headless 加载无白屏；滚轮/按钮调用不抛异常。
- [ ] **Step 6: Commit** `feat(web): 知识地图缩放/操作逻辑优化（滚轮/双击/工具栏/适配/小地图）`

---

### Task 3: 节点详情抽屉 + 整体布局优化

**Files:**
- Modify: `apps/web/src/pages/KnowledgeMap.tsx`；可选新建 `apps/web/src/components/pages/KnowledgeMapDetailDrawer.tsx`

**Interfaces:**
- Consumes: 节点 `DocNode/CategoryNode/QuestionNode`、现有 tooltip 数据。
- Produces: `selectedNode` state + 右侧 overlay 抽屉组件；`openDetail(node)`/`closeDetail()`。

- [ ] **Step 1: 点击节点开详情**：点文档/分类/问题节点 → `openDetail(Node)`；点击空白关闭。悬停 tooltip 保留（轻量）。
- [ ] **Step 2: 详情抽屉内容**：文档节点显示——名称、分类、状态+validityNote、作者、版本、被问/被引次数、所属空间、来源；**关联问题**列表（该 docId 的 questions，含 asked/可信度/引用）；问题节点显示问题文本 + 关联文档 + 引用高亮；分类节点显示 count/questions/health 雷达或进度。排版按 design-system 卡片/键值对。
- [ ] **Step 3: 布局优化**：详情用**右侧 slide-over**（framer-motion，宽 ~360-400px，遮罩 + Esc 关闭），不挤占图谱；打开时把右侧「热点 Top3」栏让位（隐藏或后移），保证图谱在 8-9 列主区仍可见；移动端抽屉全屏。
- [ ] **Step 4: 验证**：`tsc`/`build`/`lint` 0；headless 点一个节点 → 抽屉 DOM 含详情文本 + 关联问题；Esc/遮罩关闭；热点侧栏让位逻辑正常。
- [ ] **Step 5: Commit** `feat(web): 知识地图节点详情抽屉 + 布局优化`

---

## Self-Review 记录

- Spec 覆盖：A+B（Task 1）、缩放交互（Task 2）、节点详情+布局（Task 3），全在单页实现。
- 占位符：无 TBD；每任务含交互描述 + 验证步骤；完整代码由实现者按现有 KnowledgeMap.tsx 模式书写（前端无单测，验证靠 tsc/build/lint + headless 渲染）。
- 类型一致：沿用 `DocNode/CategoryNode/QuestionNode`、`view`/`setView`、`filteredDocs`；新状态 `viewMode/dim/selectedNode` 在 Task 间一致。
