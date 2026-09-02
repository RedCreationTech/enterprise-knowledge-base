import "./Intro.css";

const CAPABILITIES = ["知识管理", "智能问答", "多渠道集成"];

interface Props {
  step: number;
}

export default function Intro({ step }: Props) {
  return (
    <div className="in-scene">
      {/* Step 0: Title */}
      <div className={`in-layer ${step === 0 ? "in-visible" : ""}`}>
        <h1 className="in-title">企业知识库</h1>
      </div>

      {/* Step 1: Core capabilities */}
      <div className={`in-layer ${step === 1 ? "in-visible" : ""}`}>
        <div className="in-spaces">
          {CAPABILITIES.map((s, i) => (
            <span
              key={s}
              className="in-space-tag"
              style={{ animationDelay: `${i * 120}ms` }}
            >
              {s}
            </span>
          ))}
        </div>
      </div>

      {/* Step 2: Positioning line */}
      <div className={`in-layer ${step === 2 ? "in-visible" : ""}`}>
        <p className="in-position">
          面向企业内部的知识管理与智能问答平台
        </p>
      </div>

      {/* Blueprint grid decoration */}
      <div className="in-grid-overlay" />
    </div>
  );
}
