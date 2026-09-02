import "./AnalyticsSecurity.css";

interface Props {
  step: number;
}

const ROLES = [
  { name: "管理员", desc: "全部权限" },
  { name: "知识管理员", desc: "知识空间管理" },
  { name: "空间管理员", desc: "单空间管理" },
  { name: "文档审核员", desc: "文档审核发布" },
  { name: "助手运营员", desc: "AI 助手运营" },
  { name: "普通成员", desc: "查看与提问" },
];

export default function AnalyticsSecurity({ step }: Props) {
  return (
    <div className="as-scene">
      {/* Step 0: Analytics screenshot */}
      <div className={`as-layer ${step === 0 ? "as-visible" : ""}`}>
        <img src="/screenshots/analytics.png" alt="运营分析" className="as-img" />
        <div className="as-label">运营分析 · 使用趋势 · 知识治理 · 反馈闭环</div>
      </div>

      {/* Step 1: Governance alerts */}
      <div className={`as-layer ${step === 1 ? "as-visible" : ""}`}>
        <div className="as-governance">
          <div className="as-section-title">知识治理</div>
          <div className="as-alert-grid">
            <div className="as-alert-card as-alert-warn">
              <span className="as-alert-icon">!</span>
              <div>
                <div className="as-alert-title">过期文档</div>
                <div className="as-alert-desc">超过复审周期自动提醒</div>
              </div>
            </div>
            <div className="as-alert-card as-alert-error">
              <span className="as-alert-icon">!</span>
              <div>
                <div className="as-alert-title">版本冲突</div>
                <div className="as-alert-desc">内容冲突自动识别</div>
              </div>
            </div>
            <div className="as-alert-card as-alert-info">
              <span className="as-alert-icon">i</span>
              <div>
                <div className="as-alert-title">缺失知识</div>
                <div className="as-alert-desc">高频问题无覆盖时主动提示</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Step 2: Role cards */}
      <div className={`as-layer ${step === 2 ? "as-visible" : ""}`}>
        <div className="as-roles">
          <div className="as-section-title">角色权限体系</div>
          {ROLES.map((r, i) => (
            <div
              key={r.name}
              className="as-role-card"
              style={{ animationDelay: `${200 + i * 80}ms` }}
            >
              <span className="as-role-level">{i + 1}</span>
              <span className="as-role-name">{r.name}</span>
              <span className="as-role-desc">{r.desc}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Step 3: Account mapping */}
      <div className={`as-layer ${step === 3 ? "as-visible" : ""}`}>
        <div className="as-mapping">
          <div className="as-section-title">账号自动映射</div>
          <div className="as-map-row">
            <div className="as-map-source">飞书</div>
            <div className="as-map-arrow" />
            <div className="as-map-dest">系统角色</div>
          </div>
          <div className="as-map-row">
            <div className="as-map-source">钉钉</div>
            <div className="as-map-arrow" />
            <div className="as-map-dest">系统角色</div>
          </div>
          <div className="as-map-row">
            <div className="as-map-source">企业微信</div>
            <div className="as-map-arrow" />
            <div className="as-map-dest">系统角色</div>
          </div>
          <div className="as-map-note">无需重新建账号，自动同步</div>
        </div>
      </div>
    </div>
  );
}
