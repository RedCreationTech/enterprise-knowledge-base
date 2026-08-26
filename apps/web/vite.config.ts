import path from "path"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"
import { inspectAttr } from 'plugin-inspect-react-code'

// 后端 API 代理目标，可通过环境变量覆盖（例如本机 8080 被占用时）：
//   VITE_PROXY_TARGET=http://localhost:18080 npm run dev:web
const API_PROXY_TARGET = process.env.VITE_PROXY_TARGET ?? 'http://localhost:8080'

// https://vite.dev/config/
export default defineConfig({
  base: './',
  plugins: [inspectAttr(), react()],
  server: {
    port: 3000,
    proxy: { '/api': { target: API_PROXY_TARGET, changeOrigin: true } },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        // P1-7：recharts 仅 Analytics/DailyTodo 使用，独立 chunk 按需加载；
        // framer-motion 多页共享，独立 chunk 利于长期缓存。
        // 用函数形式仅匹配包自身模块，避免把 react 等共享依赖一并吞入 vendor chunk。
        manualChunks(id) {
          if (id.includes("node_modules")) {
            // react 生态显式独立 chunk，避免被其他 vendor chunk 吞入导致入口反向依赖 recharts
            if (/node_modules\/(react|react-dom|scheduler)\//.test(id)) return "react-vendor";
            if (/node_modules\/(recharts|d3-|victory-vendor)/.test(id)) return "recharts";
            if (/node_modules\/(framer-motion|motion-)/.test(id)) return "framer-motion";
            // 其余第三方依赖统一 vendor，避免共享小依赖（clsx 等）被吞入 recharts 导致入口反向静态依赖
            return "vendor";
          }
        },
      },
    },
  },
});
