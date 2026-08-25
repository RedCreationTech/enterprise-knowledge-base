import path from "path"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"
import { inspectAttr } from 'plugin-inspect-react-code'

// https://vite.dev/config/
export default defineConfig({
  base: './',
  plugins: [inspectAttr(), react()],
  server: {
    port: 3000,
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
