// 渲染辅助工具 - 纯函数，无副作用，不依赖全局状态
// main.ts 中的工具函数抽取，渐进式架构优化

import type { NewsItem } from './dataService'

/**
 * 获取基础路径（支持 GitHub Pages 和本地开发）
 */
export function getBasePath(): string {
  const hostname = typeof window !== 'undefined' ? window.location.hostname : ''
  const isGitHubPages = hostname.includes('github.io')
  return isGitHubPages ? '/oritek-world-monitor' : ''
}

/**
 * 生成唯一 ID
 */
export function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

/**
 * 格式化相对时间
 */
export function formatRelativeTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  const diff = Date.now() - d.getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}分钟前`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}小时前`
  const days = Math.floor(hours / 24)
  return `${days}天前`
}

/**
 * 截断文本，添加省略号
 */
export function truncate(text: string, maxLength: number): string {
  return text.length > maxLength ? text.slice(0, maxLength) + '...' : text
}

/**
 * 热点图标映射
 */
export const HOTSPOT_ICONS: Record<string, string> = {
  conflict: '⚔️',
  diplomacy: '🤝',
  economy: '📊',
  tech: '💻',
  policy: '📜',
}

/**
 * 热点影响等级颜色
 */
export const HOTSPOT_IMPACT_STYLES: Record<string, { color: string; bg: string }> = {
  high:   { color: '#ff4d4f', bg: 'rgba(255,77,79,0.15)' },
  medium: { color: '#faad14', bg: 'rgba(250,173,20,0.15)' },
  low:    { color: '#52c41a', bg: 'rgba(82,196,26,0.15)' },
}

/**
 * 新闻优先级样式
 */
export const PRIORITY_STYLES: Record<string, { label: string; color: string }> = {
  critical: { label: '紧急', color: '#ff4d4f' },
  warning:  { label: '关注', color: '#faad14' },
  info:     { label: '普通', color: '#1890ff' },
}

/**
 * 获取新闻优先级样式
 */
export function getNewsPriorityStyle(priority: string) {
  return PRIORITY_STYLES[priority] || PRIORITY_STYLES.info
}

/**
 * 行业板块图标
 */
export const INDUSTRY_ICONS: Record<string, string> = {
  semiconductor: '💎',
  automotive:    '🚗',
  robotics:       '🤖',
  ai:             '🧠',
  all:            '⚡',
}

/**
 * 行业板块颜色
 */
export const INDUSTRY_COLORS: Record<string, string> = {
  semiconductor: '#3b82f6',
  automotive:    '#10b981',
  robotics:      '#8b5cf6',
  ai:            '#06b6d4',
  all:           '#f59e0b',
}

/**
 * 股票涨跌颜色（中国市场：红涨绿跌）
 */
export function getStockColor(change: number): string {
  return change > 0 ? '#ff4d4f' : change < 0 ? '#52c41a' : '#8c8c8c'
}

/**
 * 数字格式化（添加千位分隔符）
 */
export function formatNumber(num: number): string {
  return num.toLocaleString('zh-CN')
}

/**
 * 百分比格式化
 */
export function formatPercent(value: number, decimals = 2): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(decimals)}%`
}

/**
 * 生成星级评分
 */
export function generateStars(score: number, max = 5): string {
  const filled = Math.round(score / (100 / max))
  return '★'.repeat(filled) + '☆'.repeat(max - filled)
}
