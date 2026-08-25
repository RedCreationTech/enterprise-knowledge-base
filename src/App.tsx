/**
 * 路由骨架（design.md §8 + V1.1-§8 增补 + V1.3 v13-unify：应用中心/每日待办并入工作台 + V1.4 v14-unify：快速配置/验证答案/邀请同事并入工作台）
 * - Activation 页面嵌套在 <ActivationShell/>（Outlet 模式），Workspace 页面嵌套在 <WorkspaceShell/>
 * - `/` 无条件重定向到 /workspace/dashboard（首页优先，未激活也可直接访问全部 workspace 页面）
 * - /trial/* 步骤守卫放宽：所有试用页面允许直接访问（步骤条仍按 store 状态显示进度）
 * - 激活后 /trial/* → /workspace/dashboard（apply/activated）
 * - V1.3：/trial/apps、/trial/daily 无论何时均 301 → /workspace/apps、/workspace/daily（透传 query/hash）
 * - V1.4：/trial/config、/trial/verify、/trial/invite 301 → /workspace/quick-config、/workspace/verify-answer、/workspace/invite-team（透传 query/hash）
 * - P1-7：全部页面 React.lazy 路由级代码分割（布局 Shell / store 保持静态），<Suspense> 居中加载态避免白屏
 * - P1-9：全局唯一 <Toaster/>（sonner，top-center，中性样式）挂载于 AppStoreProvider 内层
 */
import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router'
import { Toaster } from 'sonner'
import { AppStoreProvider, useAppStore } from '@/mocks/store'
import { ActivationShell } from '@/components/layout/ActivationShell'
import { WorkspaceShell } from '@/components/layout/WorkspaceShell'

const TrialApply = lazy(() => import('@/pages/TrialApply'))
const QuickConfig = lazy(() => import('@/pages/QuickConfig'))
const VerifyAnswer = lazy(() => import('@/pages/VerifyAnswer'))
const InviteTeam = lazy(() => import('@/pages/InviteTeam'))
const InstallApp = lazy(() => import('@/pages/InstallApp'))
const DailyTodo = lazy(() => import('@/pages/DailyTodo'))
const Activated = lazy(() => import('@/pages/Activated'))
const Dashboard = lazy(() => import('@/pages/Dashboard'))
const KnowledgeSite = lazy(() => import('@/pages/KnowledgeSite'))
const KnowledgeBase = lazy(() => import('@/pages/KnowledgeBase'))
const AiAssistant = lazy(() => import('@/pages/AiAssistant'))
const Analytics = lazy(() => import('@/pages/Analytics'))
const Feedback = lazy(() => import('@/pages/Feedback'))
const Settings = lazy(() => import('@/pages/Settings'))
const KnowledgeSpaces = lazy(() => import('@/pages/KnowledgeSpaces'))
const KnowledgeMap = lazy(() => import('@/pages/KnowledgeMap'))
const DataSources = lazy(() => import('@/pages/DataSources'))
const ChatHistory = lazy(() => import('@/pages/ChatHistory'))
const Instructions = lazy(() => import('@/pages/Instructions'))
const Integrations = lazy(() => import('@/pages/Integrations'))
const ApiDev = lazy(() => import('@/pages/ApiDev'))
const Permissions = lazy(() => import('@/pages/Permissions'))

/** 路由懒加载兜底：居中轻量加载态（Spinner + 文案，贴现有设计系统），避免 chunk 加载期间白屏 */
function RouteFallback() {
  return (
    <div className="flex min-h-[50vh] w-full flex-col items-center justify-center gap-3 text-neutral-500">
      <span className="h-6 w-6 animate-spin rounded-full border-2 border-neutral-300 border-t-brand-600" />
      <span className="text-body-sm">加载中…</span>
    </div>
  )
}

/** `/` 重定向：首页优先，无条件进入工作台（未激活用户从首页欢迎横幅进入配置） */
function HomeRedirect() {
  return <Navigate to="/workspace/dashboard" replace />
}

/** Activation 区：激活后 /trial/* 重定向到工作台（apps/daily/config/verify/invite 已迁移，由各自 301 路由处理） */
function TrialArea() {
  const { state } = useAppStore()
  if (state.journey.activated) return <Navigate to="/workspace/dashboard" replace />
  return <ActivationShell />
}

/** V1.3/V1.4 旧试用路由 301：→ 工作台新路由（透传 query/hash，无论何时均生效） */
function LegacyTrialRedirect({ to }: { to: string }) {
  const location = useLocation()
  return <Navigate to={`${to}${location.search}${location.hash}`} replace />
}

/** 激活交接页：Activation 壳（无 Stepper，庆祝变体）；首页优先后允许直接访问 */
function ActivatedRoute() {
  const { state } = useAppStore()
  if (state.journey.activated) return <Navigate to="/workspace/dashboard" replace />
  return (
    <ActivationShell hideStepper>
      <Activated />
    </ActivationShell>
  )
}

function AppRoutes() {
  const location = useLocation()
  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes location={location}>
        <Route path="/" element={<HomeRedirect />} />

        {/* Activation 试用旅程（ActivationShell + Outlet 嵌套；首页优先后步骤守卫放宽，均可直接访问） */}
        <Route element={<TrialArea />}>
          <Route path="/trial/apply" element={<TrialApply />} />
        </Route>
        {/* 旧路由 301（保留 query/hash 透传，邮件/书签兼容） */}
        <Route path="/trial/apps" element={<LegacyTrialRedirect to="/workspace/apps" />} />
        <Route path="/trial/daily" element={<LegacyTrialRedirect to="/workspace/daily" />} />
        {/* V1.4：快速配置/验证答案/邀请同事迁入工作台，旧路由 301 */}
        <Route path="/trial/config" element={<LegacyTrialRedirect to="/workspace/quick-config" />} />
        <Route path="/trial/verify" element={<LegacyTrialRedirect to="/workspace/verify-answer" />} />
        <Route path="/trial/invite" element={<LegacyTrialRedirect to="/workspace/invite-team" />} />
        <Route path="/trial/activated" element={<ActivatedRoute />} />

        {/* Workspace 正式工作台（WorkspaceShell + Outlet 嵌套；首页优先，无激活守卫） */}
        <Route element={<WorkspaceShell />}>
          <Route path="/workspace/dashboard" element={<Dashboard />} />
          <Route path="/workspace/quick-config" element={<QuickConfig />} />
          <Route path="/workspace/verify-answer" element={<VerifyAnswer />} />
          <Route path="/workspace/invite-team" element={<InviteTeam />} />
          <Route path="/workspace/apps" element={<InstallApp />} />
          <Route path="/workspace/daily" element={<DailyTodo />} />
          <Route path="/workspace/knowledge-site" element={<KnowledgeSite />} />
          <Route path="/workspace/knowledge-base" element={<KnowledgeBase />} />
          <Route path="/workspace/spaces" element={<KnowledgeSpaces />} />
          <Route path="/workspace/knowledge-map" element={<KnowledgeMap />} />
          <Route path="/workspace/data-sources" element={<DataSources />} />
          <Route path="/workspace/ai-assistant" element={<AiAssistant />} />
          <Route path="/workspace/chat-history" element={<ChatHistory />} />
          <Route path="/workspace/instructions" element={<Instructions />} />
          <Route path="/workspace/integrations" element={<Integrations />} />
          <Route path="/workspace/api-dev" element={<ApiDev />} />
          <Route path="/workspace/analytics" element={<Analytics />} />
          <Route path="/workspace/feedback" element={<Feedback />} />
          <Route path="/workspace/permissions" element={<Permissions />} />
          <Route path="/workspace/settings" element={<Settings />} />
        </Route>

        <Route path="*" element={<HomeRedirect />} />
      </Routes>
    </Suspense>
  )
}

export default function App() {
  return (
    <AppStoreProvider>
      {/* P1-9：全局唯一 Toast 挂载点（top-center 与原页面级挂载一致；中性样式，不用 richColors） */}
      <Toaster position="top-center" closeButton />
      <AppRoutes />
    </AppStoreProvider>
  )
}
