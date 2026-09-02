import "./ApiTech.css";

interface Props {
  step: number;
}

const DOMAINS = [
  { name: "核心域", items: "认证 · 组织 · 空间 · 文档 · 连接器 · 知识地图 · 搜索" },
  { name: "AI 域", items: "助手 · 对话 · 指令 · 实时 QA" },
  { name: "应用与集成域", items: "应用 · 集成 · API Key · 自定义 API · Webhook" },
];

const TECH = [
  "React 19", "TypeScript", "Vite", "Tailwind CSS",
  "Fastify", "better-sqlite3", "Zod", "Framer Motion",
];

export default function ApiTech({ step }: Props) {
  return (
    <div className="at-scene">
      {/* Step 0: API domains */}
      <div className={`at-layer ${step === 0 ? "at-visible" : ""}`}>
        <div className="at-domains">
          <div className="at-section-title">RESTful API · 三大域全覆盖</div>
          {DOMAINS.map((d, i) => (
            <div
              key={d.name}
              className="at-domain-card"
              style={{ animationDelay: `${200 + i * 120}ms` }}
            >
              <div className="at-domain-header">
                <span className="at-domain-name">{d.name}</span>
              </div>
              <div className="at-domain-items">{d.items}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Step 1: Code example + quality */}
      <div className={`at-layer ${step === 1 ? "at-visible" : ""}`}>
        <div className="at-code">
          <div className="at-code-block">
            <div className="at-code-line">
              <span className="at-method-get">GET</span>
              <span className="at-code-text">/api/v1/spaces</span>
            </div>
            <div className="at-code-line at-code-response">
              <span className="at-code-text">{"→  { ok: true, data: [{ id, name, count, health }] }"}</span>
            </div>
            <div className="at-code-line" style={{ marginTop: "16px" }}>
              <span className="at-method-post">POST</span>
              <span className="at-code-text">/api/v1/knowledge-site/qa</span>
            </div>
            <div className="at-code-line at-code-response">
              <span className="at-code-text">{"→  { answered: true, answer, citations, confidence }"}</span>
            </div>
          </div>
          <div className="at-quality-row">
            <span className="at-quality-tag">Zod Schema 校验</span>
            <span className="at-quality-tag">统一信封协议</span>
            <span className="at-quality-tag">自动化测试覆盖</span>
          </div>
        </div>
      </div>

      {/* Step 2: Tech stack */}
      <div className={`at-layer ${step === 2 ? "at-visible" : ""}`}>
        <div className="at-stack">
          <div className="at-section-title">技术栈</div>
          <div className="at-tech-grid">
            {TECH.map((t, i) => (
              <span
                key={t}
                className="at-tech-tag"
                style={{ animationDelay: `${200 + i * 60}ms` }}
              >
                {t}
              </span>
            ))}
          </div>
          <div className="at-switch-row">
            <span className="at-switch-label">演示模式</span>
            <span className="at-switch-arrow" />
            <span className="at-switch-label at-switch-accent">真实 API 模式</span>
            <span className="at-switch-note">一键切换</span>
          </div>
        </div>
      </div>
    </div>
  );
}
