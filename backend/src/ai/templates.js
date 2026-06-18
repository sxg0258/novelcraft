// 预置 prompt 模板
// 用户可在风格管理里修改或自建

export const PRESET_TEMPLATES = {
  continue: {
    name: '续写',
    icon: '✍️',
    description: '基于上文自然续写',
    userPrompt: `请基于以下小说内容，自然地续写约 {length} 字。要求：
1. 保持原文的叙事风格、人物语气和节奏
2. 不要重复原文已表达的内容
3. 推进情节，制造下一个钩子
4. 不要写章节标题或注释，直接输出正文

上文：
{context}

续写：`,
    userPromptOnly: `请基于以下小说内容，自然地续写约 {length} 字。

上文：
{context}

续写：`
  },

  polish: {
    name: '润色',
    icon: '✨',
    description: '改病句、润色文字，保持原意',
    userPrompt: `请润色以下文本。要求：
1. 修正错别字、语病、标点
2. 提升文字的文学性和节奏感
3. 严格保持原意、剧情、人称
4. 不要添加新情节
5. 直接输出润色后的正文，不要加注释

原文：
{text}

润色后：`,
    userPromptOnly: `请润色以下文本，保持原意和剧情。

原文：
{text}

润色后：`
  },

  expand: {
    name: '扩写',
    icon: '📖',
    description: '把片段扩写得更详细',
    userPrompt: `请把以下片段扩写为约 {length} 字。要求：
1. 增加环境描写、人物动作、心理活动
2. 保持原意和剧情走向
3. 文风与原文一致

原文：
{text}

扩写后：`
  },

  shrink: {
    name: '缩写',
    icon: '📝',
    description: '压缩文字、保留核心',
    userPrompt: `请把以下文本缩写为约 {length} 字。要求：
1. 保留核心情节和关键信息
2. 删除冗余描写和重复表达
3. 文风与原文一致

原文：
{text}

缩写后：`
  },

  chat: {
    name: '讨论',
    icon: '💬',
    description: '和 AI 讨论角色、情节',
    userPrompt: `你现在是一位经验丰富的小说编辑，正在和作者讨论作品《{bookTitle}》。请基于作品设定和当前章节内容，给出有建设性的建议。

作者问题：{question}

请直接回答。`
  }
}

/**
 * 替换模板变量
 */
export function fillTemplate(template, vars) {
  return template.replace(/\{(\w+)\}/g, (m, key) => vars[key] ?? m)
}
