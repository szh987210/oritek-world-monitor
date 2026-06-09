/// <reference types="vite/client" />

// #10: 生产日志开关 — Vite define 注入全局变量
declare const __DEBUG__: boolean

// #1: 环境变量类型声明
interface ImportMetaEnv {
  readonly VITE_RSS2JSON_API_KEY: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
