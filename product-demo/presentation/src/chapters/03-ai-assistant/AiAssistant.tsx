import "./AiAssistant.css";

interface Props {
  step: number;
}

export default function AiAssistant({ step }: Props) {
  return (
    <div className="ai-scene">
      {/* Step 0: AI assistant screenshot */}
      <div className={`ai-layer ${step === 0 ? "ai-visible" : ""}`}>
        <img src="/screenshots/ai-assistant.png" alt="AI 助手" className="ai-img" />
        <div className="ai-label">AI 助手 · 知识检索 · 智能问答</div>
      </div>

      {/* Step 1: Q&A highlight */}
      <div className={`ai-layer ${step === 1 ? "ai-visible" : ""}`}>
        <div className="ai-qa">
          <div className="ai-question">
            <span className="ai-q-mark">Q</span>
            <span>报价审批流程是什么？</span>
          </div>
          <div className="ai-answer">
            <span className="ai-a-mark">A</span>
            <span>报价审批需经过销售主管初审、财务复核、总经理终审三级流程。初审周期为 1 个工作日，复核 2 个工作日。</span>
          </div>
          <div className="ai-cite-bar">
            <span className="ai-cite-doc">引用：销售审批流程手册 v2.1</span>
            <span className="ai-cite-date">更新：2024-05-15</span>
          </div>
        </div>
      </div>

      {/* Step 2: Citation + confidence + honest refusal */}
      <div className={`ai-layer ${step === 2 ? "ai-visible" : ""}`}>
        <div className="ai-trust-layout">
          <div className="ai-cite-card">
            <div className="ai-cite-header">引用来源</div>
            <div className="ai-cite-row">
              <span className="ai-cite-label">文档</span>
              <span className="ai-cite-value">销售审批流程手册 v2.1</span>
            </div>
            <div className="ai-cite-row">
              <span className="ai-cite-label">空间</span>
              <span className="ai-cite-value">销售知识</span>
            </div>
            <div className="ai-cite-row">
              <span className="ai-cite-label">更新</span>
              <span className="ai-cite-value">2024-05-15</span>
            </div>
          </div>
          <div className="ai-trust-right">
            <div className="ai-confidence-badge">
              <span className="ai-conf-num">92</span>
              <span className="ai-conf-unit">%</span>
            </div>
            <div className="ai-conf-label">置信度评分</div>
            <div className="ai-conf-note">基于知识库匹配度计算</div>
            <div className="ai-refuse-note">
              未知问题诚实拒答，不编造答案
            </div>
          </div>
        </div>
      </div>

      {/* Step 3: Instructions screenshot */}
      <div className={`ai-layer ${step === 3 ? "ai-visible" : ""}`}>
        <img src="/screenshots/instructions.png" alt="指令管理" className="ai-img" />
        <div className="ai-label">指令管理 · 预置指令 + 自定义指令 · 版本管理与回滚</div>
      </div>
    </div>
  );
}
