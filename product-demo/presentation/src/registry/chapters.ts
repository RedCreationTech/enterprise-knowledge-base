import type { ChapterDef } from "./types";
import Intro from "../chapters/01-intro/Intro";
import { narrations as introNarrations } from "../chapters/01-intro/narrations";
import Knowledge from "../chapters/02-knowledge/Knowledge";
import { narrations as knowledgeNarrations } from "../chapters/02-knowledge/narrations";
import AiAssistant from "../chapters/03-ai-assistant/AiAssistant";
import { narrations as aiNarrations } from "../chapters/03-ai-assistant/narrations";
import Ecosystem from "../chapters/04-ecosystem/Ecosystem";
import { narrations as ecoNarrations } from "../chapters/04-ecosystem/narrations";
import AnalyticsSecurity from "../chapters/05-analytics-security/AnalyticsSecurity";
import { narrations as asNarrations } from "../chapters/05-analytics-security/narrations";
import ApiTech from "../chapters/06-api-tech/ApiTech";
import { narrations as atNarrations } from "../chapters/06-api-tech/narrations";

export const CHAPTERS: ChapterDef[] = [
  {
    id: "intro",
    title: "产品定位",
    narrations: introNarrations,
    Component: Intro,
  },
  {
    id: "knowledge",
    title: "知识管理",
    narrations: knowledgeNarrations,
    Component: Knowledge,
  },
  {
    id: "ai-assistant",
    title: "AI 助手",
    narrations: aiNarrations,
    Component: AiAssistant,
  },
  {
    id: "ecosystem",
    title: "应用与集成",
    narrations: ecoNarrations,
    Component: Ecosystem,
  },
  {
    id: "analytics-security",
    title: "运营分析与权限",
    narrations: asNarrations,
    Component: AnalyticsSecurity,
  },
  {
    id: "api-tech",
    title: "开放能力与技术栈",
    narrations: atNarrations,
    Component: ApiTech,
  },
];
