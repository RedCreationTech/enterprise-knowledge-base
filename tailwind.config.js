/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // shadcn CSS-variable palette (kept for src/components/ui/*)
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive) / <alpha-value>)",
          foreground: "hsl(var(--destructive-foreground) / <alpha-value>)",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
        // design.md §3 — 企业知识库设计 tokens（逐字落地）
        brand: {
          50: '#F5F8FF',
          100: '#EAF2FF',
          300: '#8DB2FF',
          500: '#2F74FF',
          600: '#1E63F4',
          700: '#174FCF',
        },
        neutral: {
          50: '#F7F9FC',
          100: '#EEF2F7',
          200: '#E4EAF2',
          300: '#CBD5E1',
          400: '#8490A4',
          500: '#64748B',
          700: '#475569',
          800: '#25324A',
          950: '#101828',
        },
        success: { DEFAULT: '#16A563', bg: '#EAF9F1' },
        warning: { DEFAULT: '#B45309', bg: '#FFF7E7', accent: '#E99812' },
        danger: { DEFAULT: '#E5484D', bg: '#FFF0F0', border: '#F1A1A4' },
        info: { DEFAULT: '#1E63F4', bg: '#EAF2FF' },
        violet: { DEFAULT: '#7357E8', bg: '#F1EEFF' },
        cyan: { DEFAULT: '#159FB7', bg: '#E8FAFC' },
        surface: {
          page: '#F7F9FC',
          DEFAULT: '#FFFFFF',
          soft: '#FBFCFE',
          selected: '#F5F8FF',
          cardSel: '#F8FAFF',
          assistant: '#F3F6FA',
          user: '#EAF2FF',
          upload: '#FBFCFF',
          highlight: '#FFF4C2',
        },
        chart: {
          blue: '#2F74FF', green: '#22B573', violet: '#7357E8',
          orange: '#F3A53A', cyan: '#26A9C4', red: '#E5484D',
        },
      },
      borderRadius: {
        sm: '6px',
        md: '8px',
        lg: '12px',
        xl: '16px',
        pill: '999px',
      },
      boxShadow: {
        xs: "0 1px 2px 0 rgb(0 0 0 / 0.05)",
        card: '0 8px 24px rgba(31, 55, 90, 0.06)',
        float: '0 12px 32px rgba(31, 55, 90, 0.10)',
        focus: '0 0 0 3px rgba(47, 116, 255, 0.16)',
        input: '0 0 0 3px rgba(47, 116, 255, 0.12)',
      },
      fontSize: {
        display: ['32px', { lineHeight: '42px', fontWeight: '700' }],
        h1: ['28px', { lineHeight: '38px', fontWeight: '700' }],
        h2: ['22px', { lineHeight: '30px', fontWeight: '700' }],
        h3: ['18px', { lineHeight: '26px', fontWeight: '600' }],
        'body-lg': ['16px', { lineHeight: '26px', fontWeight: '400' }],
        body: ['14px', { lineHeight: '22px', fontWeight: '400' }],
        'body-sm': ['13px', { lineHeight: '20px', fontWeight: '400' }],
        caption: ['12px', { lineHeight: '18px', fontWeight: '400' }],
        'metric-lg': ['30px', { lineHeight: '38px', fontWeight: '700' }],
        metric: ['24px', { lineHeight: '32px', fontWeight: '700' }],
      },
      spacing: { 18: '72px' },
      maxWidth: { content: '1680px' },
      transitionTimingFunction: { brand: 'cubic-bezier(0.2, 0.8, 0.2, 1)' },
      transitionDuration: { micro: '120ms', comp: '180ms', modal: '240ms' },
      fontFamily: {
        sans: ['Inter', '"PingFang SC"', '"Microsoft YaHei"', '"Noto Sans SC"', 'system-ui', 'sans-serif'],
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "caret-blink": {
          "0%,70%,100%": { opacity: "1" },
          "20%,50%": { opacity: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "caret-blink": "caret-blink 1.25s ease-out infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
}
