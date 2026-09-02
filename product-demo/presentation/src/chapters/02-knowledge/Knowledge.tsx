import "./Knowledge.css";

interface Props {
  step: number;
}

const FEATURES = [
  "按空间分类组织",
  "版本记录与状态标签",
  "责任人与来源信息",
  "自动标记复审",
];

export default function Knowledge({ step }: Props) {
  return (
    <div className="kn-scene">
      {/* Step 0: Dashboard screenshot */}
      <div className={`kn-layer ${step === 0 ? "kn-visible" : ""}`}>
        <img src="/screenshots/dashboard.png" alt="工作台" className="kn-img" />
        <div className="kn-label">工作台 · 今日待办 · 运营数据 · 趋势图表</div>
      </div>

      {/* Step 1: Document list + features */}
      <div className={`kn-layer ${step === 1 ? "kn-visible" : ""}`}>
        <div className="kn-feat-layout">
          <div className="kn-feat-screenshot">
            <img src="/screenshots/knowledge-base.png" alt="文档列表" className="kn-img" />
          </div>
          <div className="kn-feat-list">
            <div className="kn-feat-title">知识管理</div>
            {FEATURES.map((f, i) => (
              <div
                key={f}
                className="kn-feat-item"
                style={{ animationDelay: `${200 + i * 100}ms` }}
              >
                <span className="kn-feat-dot" />
                <span>{f}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Step 2: Knowledge map screenshot */}
      <div className={`kn-layer ${step === 2 ? "kn-visible" : ""}`}>
        <img src="/screenshots/knowledge-map.png" alt="知识地图" className="kn-img" />
        <div className="kn-label">知识地图 · 可视化知识分布 · 多维度视图</div>
      </div>

      {/* Step 3: Knowledge map with dimension switch */}
      <div className={`kn-layer ${step === 3 ? "kn-visible" : ""}`}>
        <img src="/screenshots/knowledge-map.png" alt="知识地图" className="kn-img" />
        <div className="kn-dim-badges">
          <span className="kn-dim kn-dim-active">分类</span>
          <span className="kn-dim">类型</span>
          <span className="kn-dim kn-dim-warn">状态</span>
          <span className="kn-dim">作者</span>
        </div>
        <div className="kn-alert-badge">过期 · 冲突 · 缺失 · 可视化</div>
      </div>
    </div>
  );
}
