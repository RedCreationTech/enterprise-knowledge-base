/**
 * DemoEmptyState — 内容页冷启动空态（与运营页「还没有运营数据」一致的引导空态）。
 * 当 demoData === false（未载入演示数据）时，8 个内容页替换数据区为统一空态，
 * 提供「载入演示数据」+「开始快速配置」双出口，修复冷启动叙事半程破裂（评审 P1-N1）。
 */
import { useNavigate } from 'react-router'
import { EmptyState } from '@/components/common/EmptyState'
import { useAppStore } from '@/mocks/store'
import { useAppToast } from '@/lib/toast'

export function DemoEmptyState() {
  const navigate = useNavigate()
  const { loadDemoData } = useAppStore()
  const toast = useAppToast()

  const handleLoadDemo = () => {
    loadDemoData()
    toast.success('已载入演示数据')
  }

  return (
    <div className="rounded-xl border border-neutral-200 bg-white shadow-card">
      <EmptyState
        title="还没有运营数据"
        description="完成快速配置或载入演示数据后，这里会展示真实的企业知识数据。"
        action={
          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={handleLoadDemo}
              className="inline-flex h-10 items-center rounded-md bg-brand-600 px-4 text-body-sm font-medium text-white transition-colors duration-micro ease-brand hover:bg-brand-500"
            >
              载入演示数据
            </button>
            <button
              type="button"
              onClick={() => navigate('/workspace/quick-config')}
              className="inline-flex h-10 items-center rounded-md border border-[#BFD0F2] bg-white px-4 text-body-sm text-brand-600 transition-colors duration-micro ease-brand hover:bg-brand-50"
            >
              开始快速配置
            </button>
          </div>
        }
      />
    </div>
  )
}
