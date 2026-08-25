/** StatusBadge — 浅底深字 pill，覆盖 design.md §7 全部状态文案并映射语义色 */
import { cn } from '@/lib/utils'

type Tone = 'success' | 'warning' | 'danger' | 'info' | 'violet' | 'cyan' | 'neutral'

const STATUS_TONE: Record<string, Tone> = {
  已连接: 'success',
  已导入: 'success',
  已完成: 'success',
  已安装: 'success',
  已发布: 'success',
  优秀: 'success',
  答案正确: 'success',
  已确认: 'success',
  已处理: 'success',
  未连接: 'neutral',
  待处理: 'warning',
  已过期: 'warning',
  即将过期: 'warning',
  部分失败: 'warning',
  待确认重复: 'warning',
  进行中: 'info',
  已发送: 'info',
  已就绪: 'info',
  可试用: 'violet',
  需要授权: 'warning',
  同步中: 'cyan',
  上传中: 'cyan',
  'OCR 中': 'cyan',
  解析中: 'cyan',
  存在冲突: 'danger',
  高风险: 'danger',
  失败: 'danger',
  已跳过: 'neutral',
  已转交: 'info',
}

const TONE_CLASS: Record<Tone, string> = {
  success: 'bg-success-bg text-success',
  warning: 'bg-warning-bg text-warning',
  danger: 'bg-danger-bg text-danger',
  info: 'bg-info-bg text-info',
  violet: 'bg-violet-bg text-violet',
  cyan: 'bg-cyan-bg text-cyan',
  neutral: 'bg-neutral-100 text-neutral-500',
}

export interface StatusBadgeProps {
  status: string
  className?: string
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const tone = STATUS_TONE[status] ?? 'neutral'
  return (
    <span
      className={cn(
        'inline-flex h-6 items-center gap-1 whitespace-nowrap rounded-pill px-2 text-caption font-medium',
        TONE_CLASS[tone],
        className,
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {status}
    </span>
  )
}
