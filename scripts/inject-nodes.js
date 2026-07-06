/**
 * Sub-Store 文件脚本操作 - sing-box 节点注入
 *
 * 用法（填入脚本操作链接处）：
 *   <此脚本的 raw URL>#name=你的订阅名称&type=0
 *
 * 参数说明：
 *   name  : Sub-Store 中已建好的订阅名称（单条或组合订阅的名字）
 *   type  : 0 = 单条订阅（Subscription），1 = 组合订阅（Collection）
 */

async function operator(proxies = [], targetPlatform, context) {
  // ---------- 读取参数 ----------
  const url = context?.arguments?.url ?? ""
  const hash = url.split("#")[1] ?? ""
  const params = Object.fromEntries(
    hash.split("&").map((p) => p.split("=").map(decodeURIComponent))
  )

  const subName = params["name"]
  const subType = params["type"] === "1" ? "collection" : "sub"

  if (!subName) {
    throw new Error("[inject-nodes] 缺少参数 name，请在脚本链接后加 #name=你的订阅名称")
  }

  // ---------- 从 Sub-Store API 获取节点（sing-box 格式） ----------
  const apiBase = context?.api?.url ?? "http://127.0.0.1:3001"
  const fetchUrl = `${apiBase}/download/${encodeURIComponent(subName)}?target=singbox`

  let subConfig
  try {
    const resp = await $fetch(fetchUrl)
    subConfig = JSON.parse(resp.body)
  } catch (e) {
    throw new Error(`[inject-nodes] 获取订阅失败: ${e.message}`)
  }

  // 取出节点：过滤掉 selector / urltest / direct / block / dns 等非代理 outbound
  const SYSTEM_TYPES = new Set(["selector", "urltest", "direct", "block", "dns"])
  const nodeOutbounds = (subConfig?.outbounds ?? []).filter(
    (o) => !SYSTEM_TYPES.has(o.type)
  )

  if (nodeOutbounds.length === 0) {
    throw new Error("[inject-nodes] 订阅中未找到任何节点，请检查订阅名称和类型是否正确")
  }

  const nodeTags = nodeOutbounds.map((o) => o.tag)

  // ---------- 操作模板（$content 是当前文件的内容） ----------
  let config
  try {
    config = JSON.parse($content)
  } catch (e) {
    throw new Error("[inject-nodes] 模板 JSON 解析失败，请检查模板文件格式")
  }

  // 替换 手动选择 和 自动选择 的 outbounds
  for (const outbound of config.outbounds) {
    if (outbound.tag === "手动选择" || outbound.tag === "自动选择") {
      // 移除 PLACEHOLDER，插入真实节点 tag
      outbound.outbounds = nodeTags
    }
  }

  // 将节点本身追加到顶层 outbounds（放在 direct 之前）
  const directIndex = config.outbounds.findIndex((o) => o.tag === "direct")
  if (directIndex !== -1) {
    config.outbounds.splice(directIndex, 0, ...nodeOutbounds)
  } else {
    config.outbounds.push(...nodeOutbounds)
  }

  // 写回
  $content = JSON.stringify(config, null, 2)

  // 脚本操作不需要返回 proxies，原样返回即可
  return proxies
}
