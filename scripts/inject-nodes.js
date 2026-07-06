/**
 * Sub-Store 文件脚本 - sing-box 节点注入
 *
 * Sub-Store 文件管理 → 脚本操作 → 填入此脚本的 raw URL
 * 无需任何参数，Sub-Store 会自动把节点通过 $nodes 传入
 */

const SYSTEM_TAGS = new Set(["proxy", "手动选择", "自动选择", "direct", "block", "dns-out"])

// $content 是模板 JSON 字符串，由 Sub-Store 注入
let config
try {
  config = JSON.parse($content)
} catch (e) {
  throw new Error("模板 JSON 解析失败，请检查模板文件内容：" + e.message)
}

// $nodes 是 Sub-Store 解析好的节点数组（sing-box outbound 格式）
// 过滤掉系统 outbound，只保留真正的代理节点
const nodeOutbounds = ($nodes ?? []).filter(
  (o) => o && o.tag && !SYSTEM_TAGS.has(o.tag)
)

if (nodeOutbounds.length === 0) {
  throw new Error("没有获取到任何节点，请检查订阅是否有效，以及文件关联的订阅名称是否正确")
}

const nodeTags = nodeOutbounds.map((o) => o.tag)

// 把节点 tag 填入 手动选择 和 自动选择 的 outbounds 数组
for (const outbound of config.outbounds) {
  if (outbound.tag === "手动选择" || outbound.tag === "自动选择") {
    outbound.outbounds = nodeTags
  }
}

// 把节点本身插入顶层 outbounds，放在 direct 之前
const directIndex = config.outbounds.findIndex((o) => o.tag === "direct")
if (directIndex !== -1) {
  config.outbounds.splice(directIndex, 0, ...nodeOutbounds)
} else {
  config.outbounds.push(...nodeOutbounds)
}

// 写回，Sub-Store 会把这个内容作为最终输出
$content = JSON.stringify(config, null, 2)
