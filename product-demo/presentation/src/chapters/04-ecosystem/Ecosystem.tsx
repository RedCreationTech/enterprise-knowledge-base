import "./Ecosystem.css";

interface Props {
  step: number;
}

const CHANNELS = [
  "飞书", "企业微信", "钉钉", "官网客服", "自定义 API",
];

export default function Ecosystem({ step }: Props) {
  return (
    <div className="ec-scene">
      {/* Step 0: App center screenshot + channel tags */}
      <div className={`ec-layer ${step === 0 ? "ec-visible" : ""}`}>
        <img src="/screenshots/apps.png" alt="应用中心" className="ec-img" />
        <div className="ec-channel-row">
          {CHANNELS.map((c, i) => (
            <span
              key={c}
              className="ec-channel-tag"
              style={{ animationDelay: `${200 + i * 80}ms` }}
            >
              {c}
            </span>
          ))}
        </div>
        <div className="ec-install-note">一键安装 · 一键卸载 · 覆盖主流企业渠道</div>
      </div>

      {/* Step 1: Integration management screenshot */}
      <div className={`ec-layer ${step === 1 ? "ec-visible" : ""}`}>
        <img src="/screenshots/integrations.png" alt="集成管理" className="ec-img" />
        <div className="ec-label">集成管理 · 统一管理外部渠道连接状态</div>
      </div>

      {/* Step 2: Config panel */}
      <div className={`ec-layer ${step === 2 ? "ec-visible" : ""}`}>
        <div className="ec-config-card">
          <div className="ec-config-header">集成配置</div>
          <div className="ec-config-row">
            <span className="ec-config-label">作用域</span>
            <span className="ec-config-value">全部知识空间</span>
          </div>
          <div className="ec-config-row">
            <span className="ec-config-label">渠道映射</span>
            <span className="ec-config-value">飞书文档 → 产品知识空间</span>
          </div>
          <div className="ec-config-row">
            <span className="ec-config-label">降级策略</span>
            <span className="ec-config-value">异常时自动切换备用通道</span>
          </div>
          <div className="ec-config-row">
            <span className="ec-config-label">授权管理</span>
            <span className="ec-config-value">独立授权 · 状态监控</span>
          </div>
        </div>
      </div>
    </div>
  );
}
