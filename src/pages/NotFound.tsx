/**
 * NotFound — 真实 404 页面（替换原先 `path="*"` 的静默重定向到工作台）
 * 自包含全屏错误页，与 ErrorBoundary 错误页同一品牌风格：图标盒 + 标题 + 文案 + 双出口。
 * 「返回工作台」直达 /workspace/dashboard；「返回上一页」回退浏览器历史。
 */
import { useNavigate } from 'react-router'
import { ArrowLeft, Compass } from 'lucide-react'

export default function NotFound() {
  const navigate = useNavigate()
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-neutral-50 px-6 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50">
        <Compass className="h-7 w-7 text-brand-600" />
      </div>
      <h1 className="mt-5 text-h2 text-neutral-950">404 · 页面不存在</h1>
      <p className="mt-2 max-w-md text-body-sm text-neutral-500">
        你访问的页面不存在或已被移动，请检查网址是否正确，或返回工作台继续使用。
      </p>
      <div className="mt-6 flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate('/workspace/dashboard')}
          className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-body-sm font-medium text-white transition-colors duration-micro ease-brand hover:bg-brand-700"
        >
          返回工作台
        </button>
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-2 rounded-lg border border-neutral-200 bg-white px-4 py-2 text-body-sm font-medium text-neutral-800 transition-colors duration-micro ease-brand hover:border-brand-300 hover:text-brand-600"
        >
          <ArrowLeft className="h-4 w-4" />
          返回上一页
        </button>
      </div>
    </div>
  )
}
