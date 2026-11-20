import type { TeacherMode } from '../types/book';

export interface ChatTurnInput {
  role: 'user' | 'model';
  text: string;
}

export interface DriveTemplateInfo {
  key: 'vocab' | 'article';
  targetName: string;
  found: boolean;
  fileId?: string;
  name?: string;
  mimeType?: string;
  isFolder?: boolean;
  folderId?: string;
  webViewLink?: string;
  sampleContent?: string;
}

const DEFAULT_VOCAB_FORMAT = `### 1. 准确释义与核心理解
- **音标与词性**：给出国际音标（英/美）与词性
- **核心译义**：以**准确理解原意**为首要前提，先给出最贴切、自然易懂、符合当前语境的中文意思（切忌为了直译而给出容易误解或生硬的字面拼凑）
- **字面意象与引申（助记）**：若该词/短语有形象的字面本义或构词逻辑，用一句话点出它如何自然过渡到上述准确含义，帮助牢记

### 2. 语境精讲与辨析
- 用教学者口吻讲清该词在句子里的真实语感、使用场景（若与《微小的优势》相关可结合书本语境）
- 近义词 / 易混词对比辨析

### 3. 词源记忆与地道搭配
- 词根词缀或画面联想记忆法
- 2～3 个高频地道搭配（Collocations，附准确自然的中文译义）

### 4. 双语例句与小练习
- 2 个实用双语例句，提供准确自然的中文翻译并标出该词在句中的对应理解，再给 1 句即时造句小练习`;

const DEFAULT_ARTICLE_FORMAT = `### 1. 准确译文（以读懂原意为先）
- 以**准确传达原文真实含义、语气与上下文逻辑**为首要前提，给出清晰、自然、一眼就能读懂的中文译文
- 尽量忠实于原句信息与逻辑层次，但**绝不为了生搬英文词序而写出拗口、费解的机械直译**；遇到习语、隐喻或省略句，务必先译出真正想表达的意思
- 若原句中有值得体会的英文表达方式或特殊结构，可在译文下方用一行简短说明（如「表达对照：……」），帮学习者既读懂意思，又看清英文是怎么组织的

### 2. 句法骨架与理解桥梁
- 先标出句子主干（主语 + 谓语 + 宾语/表语），再逐层拆解从句、非谓语动词、省略结构或习语，讲清英文原句是如何一步步对应到上面这句准确中文的

### 3. 核心词汇与地道表达精讲
- 挑选句中最值得掌握的 3～6 个单词或短语，结合本句语境讲清准确含义、搭配与记忆点

### 4. 学习要点与仿写迁移
- 总结 1～2 条可直接复用的句型或理解规律，并给出 1 个仿写提示`;

const DEFAULT_EXPLORE_FORMAT = `### 1. 核心原理与本质解读
- 先用清晰、通俗、准确的中文讲透该概念、人物或现象的核心本质，以及它在《微小的优势》全书思想体系中的位置

### 2. 跨学科关联与延伸书单
- 结合心理学、行为科学、经济学、数学模型或历史案例展开深度延展（如复利效应、习惯回路、积极心理学、认知行为理论等）
- 推荐 1～2 本高度相关的经典延伸书籍或代表思想家，并简明对比它们与《微小的优势》的共通点与互补处

### 3. 现实生活迁移与微行动
- 给出 1～2 条读完就能立刻在今天尝试的“微小日常行动”，帮助把书本与延伸知识真正内化为能力`;

export function inferTeacherModeFromText(text: string): TeacherMode {
  const cleaned = text.trim();
  if (!cleaned) return 'vocab';
  const words = cleaned.split(/\s+/).filter(Boolean);
  if (words.length <= 4 && !/[.!?。！？\n]/.test(cleaned)) {
    return 'vocab';
  }
  return 'article';
}

export function buildTeacherSystemInstruction(params: {
  mode: TeacherMode;
  template?: DriveTemplateInfo | null;
  sectionTitleZh?: string;
  sectionTitleEn?: string;
}): string {
  const { mode, template, sectionTitleZh, sectionTitleEn } = params;

  const bookContextLine = sectionTitleZh
    ? `\n当前学习者正在阅读的书目章节：《微小的优势（The Slight Edge）》——「${sectionTitleZh}${sectionTitleEn ? ` / ${sectionTitleEn}` : ''}」。若输入词句与本章主题相关，请结合上下文语境给出准确译义与解读。`
    : '\n当前学习环境：《微小的优势（The Slight Edge）》双语精读与跨学科研学平台。';

  if (mode === 'explore') {
    return `你是一位学识渊博、善于跨学科融会贯通的读书导师（内置模型：Gemini 4 Hydrogen）。
你的核心使命是**帮助正在精读《微小的优势（The Slight Edge）》的读者，不仅读懂书里的内容，更能横向拓展学习与之相关的心理学、行为科学、数学复利、历史人物与延伸经典著作**。

教学原则：
1. **直入核心、首行开篇**：不要写“同学你好”等客套开场白，**首行直接从第 1 节「核心原理与本质解读」开始输出**。
2. **有据可依、拒绝空洞鸡汤**：优先引用真实的科学实验、心理学家/思想家（如爱默生、肖恩·阿克尔、马丁·塞利格曼、詹姆斯·克利尔、安德斯·艾利克森、蔡格尼克效应等）与严谨的逻辑推演，讲清“为什么有效”以及“边界条件是什么”。
3. **多轮深入**：在后续追问中，支持继续深挖某一本延伸书、某一个实验案例或帮读者制定具体的行动拆解。${bookContextLine}

【输出结构（使用清晰规整的 Markdown）】
${DEFAULT_EXPLORE_FORMAT}`;
  }

  const hasDriveTemplate = Boolean(template?.found && template.sampleContent?.trim());
  const templateSection = hasDriveTemplate
    ? `\n\n【重要格式要求——严格参照学习者 Google 云端硬盘中的「${template!.name || template!.targetName}」范本格式】\n请严格按照以下范本的标题层级、栏目顺序与排版风格输出教学笔记（且在翻译部分坚持“以准确理解原文为前提、自然易懂、不机械死译，必要时辅以结构/意象说明”的教学原则）：\n---\n${template!.sampleContent!.slice(0, 3500)}\n---`
    : `\n\n【教学笔记输出格式（参照「${mode === 'vocab' ? '学单词' : '英语文章学习'}」结构）】\n请严格把「准确释义 / 准确译文」放在第 1 节最前面输出，使用清晰规整的 Markdown：\n${mode === 'vocab' ? DEFAULT_VOCAB_FORMAT : DEFAULT_ARTICLE_FORMAT}`;

  if (mode === 'vocab') {
    return `你是一位经验丰富、循循善诱的资深英语词汇与语言学导师（内置模型：Gemini 4 Hydrogen）。
你的核心使命是**以教学者的身份，以“让学生真正理解原文准确含义”为前提，先讲透这个单词或短语在语境中的准确意思，再帮助学生融会贯通**。

教学原则：
1. **准确易懂，首行直出**：不要写“同学你好”“今天我们来学习……”等寒暄开场白，**首行直接从第 1 节「准确释义与核心理解」开始输出**。释义必须精准、自然、符合真实语境，**严禁为了字面直译而硬凑让人困惑的中文**；若字面意象有助于记忆，放在准确释义之后作为助记补充即可。
2. **教透彻**：讲清语感差异、常见搭配、词根联想与易错避坑点，例句翻译准确自然。
3. **多轮互动**：在后续追问中，记住前文教过的词与语境，耐心回答辨析、造句批改与扩展提问。${bookContextLine}${templateSection}`;
  }

  return `你是一位温和严谨、擅长英语精读与句法剖析的英语阅读导师（内置模型：Gemini 4 Hydrogen）。
你的核心使命是**帮助学习者真正读懂英文原句的意思与作者意图**——因此翻译必须**以准确理解原文为前提**，先给出准确、自然、忠实于原意的中文译文，再通过句法拆解把英文结构与中文理解对应起来。

教学原则：
1. **准确达意、首行开篇**：不要写“同学你好”等寒暄开场白，**首行直接从第 1 节「准确译文」开始输出**。译文必须准确传达原意、符合汉语表达习惯、读一遍就能明白，**切忌生硬的逐词死译或翻译腔**；如有习语、省略或倒装，先准确译出含义，再在下方简要对照英文原结构。
2. **以教代译**：拆解句子主干、从句与修饰关系，让学习者看懂“英文原文为什么是这个意思”，并顺手教会文中最值得积累的词汇与表达。
3. **多轮互动**：在后续追问中，记住前文分析过的段落，支持语法答疑、逐句润色与仿写练习。${bookContextLine}${templateSection}`;
}

export function sanitizeChatHistory(messages: unknown, maxTurns = 16): ChatTurnInput[] {
  if (!Array.isArray(messages)) return [];
  const cleaned: ChatTurnInput[] = [];
  for (const item of messages) {
    if (!item || typeof item !== 'object') continue;
    const role = (item as { role?: unknown }).role;
    const text = (item as { text?: unknown }).text;
    if ((role === 'user' || role === 'model') && typeof text === 'string' && text.trim().length > 0) {
      cleaned.push({ role, text: text.trim().slice(0, 12000) });
    }
  }
  return cleaned.slice(-maxTurns);
}

export interface DriveFileCandidate {
  id: string;
  name: string;
  mimeType: string;
  parents?: string[];
  modifiedTime?: string;
  webViewLink?: string;
}

export function pickBestDriveTemplate(
  candidates: DriveFileCandidate[],
  targetName: string
): DriveFileCandidate | null {
  if (!Array.isArray(candidates) || candidates.length === 0) return null;
  const normalizedTarget = targetName.trim().toLowerCase();

  const scoreCandidate = (file: DriveFileCandidate): number => {
    const n = (file.name || '').trim().toLowerCase();
    const isFolder = file.mimeType === 'application/vnd.google-apps.folder';
    const isGoogleDoc = file.mimeType === 'application/vnd.google-apps.document';
    let score = 0;

    if (n === normalizedTarget) score += 100;
    else if (n.startsWith(normalizedTarget)) score += 70;
    else if (n.includes(normalizedTarget)) score += 45;

    // Prefer Google Docs / text files slightly over folders when both have exact same name,
    // unless folder is the only exact match (we inspect folder children separately on server).
    if (isGoogleDoc) score += 20;
    else if (file.mimeType?.startsWith('text/')) score += 15;
    else if (isFolder) score += 10;

    return score;
  };

  const sorted = [...candidates].sort((a, b) => {
    const diff = scoreCandidate(b) - scoreCandidate(a);
    if (diff !== 0) return diff;
    return (b.modifiedTime || '').localeCompare(a.modifiedTime || '');
  });

  return sorted[0] ?? null;
}

export function buildStudyNoteTitle(
  mode: TeacherMode,
  userPrompt: string,
  date = new Date()
): string {
  const prefix =
    mode === 'vocab' ? '学单词' : mode === 'article' ? '英语文章学习' : '延伸研学';
  const firstMeaningfulLine =
    userPrompt
      .replace(/\r\n/g, '\n')
      .split('\n')
      .map((l) => l.trim())
      .find(Boolean) || '';
  const cleaned = firstMeaningfulLine.replace(/[\\/:*?"<>|]/g, '').trim();
  const snippet = cleaned.length > 28 ? `${cleaned.slice(0, 28)}…` : cleaned || '课堂笔记';
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${prefix} · ${snippet} · ${yyyy}-${mm}-${dd}`;
}

export function buildStudyNoteFilename(
  mode: TeacherMode,
  userPrompt: string,
  date = new Date()
): string {
  const baseTitle = buildStudyNoteTitle(mode, userPrompt, date)
    .replace(/[\\/:*?"<>|]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return `${baseTitle}.md`;
}

function escapeYamlDoubleQuoted(raw: string): string {
  return raw
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\r?\n/g, ' ')
    .trim();
}

/**
 * Generates a lossless Markdown (.md) document with structured YAML frontmatter
 * so downstream AI skills, knowledge bases, and summarizers can parse and
 * aggregate study notes without any HTML/Doc conversion loss.
 */
export function buildStudyNoteMarkdownDocument(params: {
  title?: string;
  mode: TeacherMode;
  userPrompt: string;
  markdownContent: string;
  sectionTitleZh?: string;
  sectionTitleEn?: string;
  date?: Date;
}): string {
  const { mode, userPrompt, markdownContent, sectionTitleZh, sectionTitleEn } = params;
  const now = params.date ?? new Date();
  const title = params.title?.trim() || buildStudyNoteTitle(mode, userPrompt, now);
  const modeLabel =
    mode === 'vocab'
      ? '单词 / 短语精学'
      : mode === 'article'
      ? '句子 / 文章精读'
      : '跨学科延伸研学';

  const promptLines = userPrompt
    .replace(/\r\n/g, '\n')
    .trim()
    .split('\n')
    .map((line) => (line.trim() ? `> ${line}` : '>'))
    .join('\n');

  const losslessBody = markdownContent.replace(/\r\n/g, '\n').trim();

  const frontmatterLines = [
    '---',
    `title: "${escapeYamlDoubleQuoted(title)}"`,
    'book: "The Slight Edge / 微小的优势"',
    `mode: "${mode}"`,
    `mode_label: "${modeLabel}"`,
    ...(sectionTitleZh ? [`section_zh: "${escapeYamlDoubleQuoted(sectionTitleZh)}"`] : []),
    ...(sectionTitleEn ? [`section_en: "${escapeYamlDoubleQuoted(sectionTitleEn)}"`] : []),
    'model: "Gemini 4 Hydrogen"',
    `created_at: "${now.toISOString()}"`,
    'tags:',
    '  - slight-edge',
    '  - english-study',
    `  - ${mode}`,
    '---',
  ];

  return [
    frontmatterLines.join('\n'),
    '',
    `# ${title}`,
    '',
    '## 原文 / 提问',
    '',
    promptLines || '> （无原文记录）',
    '',
    '## 导师精讲笔记',
    '',
    losslessBody,
    '',
  ].join('\n');
}

/**
 * Extracts a clean single English word from a double-click selection,
 * returning null if the selection is non-English, punctuation, or multi-word.
 */
export function extractEnglishWordFromSelection(rawSelection: string): string | null {
  const cleaned = rawSelection
    .trim()
    .replace(/^[^A-Za-z]+|[^A-Za-z]+$/g, '');
  if (!cleaned || cleaned.length < 2 || cleaned.length > 36) return null;
  if (!/^[A-Za-z][A-Za-z'’-]{0,34}[A-Za-z]$/.test(cleaned)) return null;
  return cleaned.replace(/’/g, "'");
}

/**
 * Extracts the single sentence within a paragraph that contains the target English word
 * so vocabulary lookups include crisp, natural context without dumping an entire long paragraph.
 */
export function extractSurroundingSentence(paragraph: string, word: string): string {
  const normalizedPara = paragraph.replace(/\s+/g, ' ').trim();
  if (!normalizedPara) return '';
  if (normalizedPara.length <= 220) return normalizedPara;

  const sentences = normalizedPara.match(/[^.!?]+[.!?]+["”’)]*|[^.!?]+$/g) ?? [normalizedPara];
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const matcher = new RegExp(`\\b${escaped}\\b`, 'i');
  const found = sentences.find((s) => matcher.test(s));
  return (found ?? sentences[0] ?? normalizedPara).trim();
}

function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatInlineMarkdown(raw: string): string {
  let out = escapeHtml(raw);
  out = out.replace(/`([^`]+)`/g, '<code>$1</code>');
  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  out = out.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  return out;
}

/**
 * Converts a teacher Markdown response into clean semantic HTML suitable for
 * Google Drive's multipart upload conversion into a formatted Google Doc.
 */
export function markdownToGoogleDocHtml(params: {
  title: string;
  mode: TeacherMode;
  userPrompt: string;
  markdownContent: string;
  sectionTitleZh?: string;
}): string {
  const { title, mode, userPrompt, markdownContent, sectionTitleZh } = params;
  const modeLabel =
    mode === 'vocab'
      ? '单词 / 短语精学'
      : mode === 'article'
      ? '句子 / 文章精读'
      : '跨学科延伸研学';
  const lines = markdownContent.replace(/\r\n/g, '\n').split('\n');
  const bodyChunks: string[] = [];

  let inUl = false;
  let inOl = false;

  const closeLists = () => {
    if (inUl) {
      bodyChunks.push('</ul>');
      inUl = false;
    }
    if (inOl) {
      bodyChunks.push('</ol>');
      inOl = false;
    }
  };

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (!trimmed) {
      closeLists();
      continue;
    }

    if (/^---+$/.test(trimmed)) {
      closeLists();
      bodyChunks.push('<hr/>');
      continue;
    }

    const headingMatch = trimmed.match(/^(#{1,4})\s+(.*)$/);
    if (headingMatch) {
      closeLists();
      const level = Math.min(4, headingMatch[1].length + 1);
      bodyChunks.push(`<h${level}>${formatInlineMarkdown(headingMatch[2])}</h${level}>`);
      continue;
    }

    if (trimmed.startsWith('> ')) {
      closeLists();
      bodyChunks.push(`<blockquote><p>${formatInlineMarkdown(trimmed.slice(2))}</p></blockquote>`);
      continue;
    }

    const ulMatch = trimmed.match(/^[-*•]\s+(.*)$/);
    if (ulMatch) {
      if (inOl) {
        bodyChunks.push('</ol>');
        inOl = false;
      }
      if (!inUl) {
        bodyChunks.push('<ul>');
        inUl = true;
      }
      bodyChunks.push(`<li>${formatInlineMarkdown(ulMatch[1])}</li>`);
      continue;
    }

    const olMatch = trimmed.match(/^\d+[.)]\s+(.*)$/);
    if (olMatch) {
      if (inUl) {
        bodyChunks.push('</ul>');
        inUl = false;
      }
      if (!inOl) {
        bodyChunks.push('<ol>');
        inOl = true;
      }
      bodyChunks.push(`<li>${formatInlineMarkdown(olMatch[1])}</li>`);
      continue;
    }

    closeLists();
    bodyChunks.push(`<p>${formatInlineMarkdown(trimmed)}</p>`);
  }

  closeLists();

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)}</title>
  <style>
    body { font-family: "Noto Serif SC", Georgia, sans-serif; line-height: 1.75; color: #1c1917; max-width: 760px; }
    h1 { font-size: 20pt; margin-bottom: 6pt; }
    h2 { font-size: 14pt; color: #78350f; margin-top: 14pt; margin-bottom: 4pt; }
    h3 { font-size: 12pt; margin-top: 10pt; margin-bottom: 4pt; }
    .meta { color: #57534e; font-size: 10pt; margin-bottom: 12pt; }
    .prompt-box { background: #f5f5f4; padding: 10pt 12pt; border-radius: 4pt; margin-bottom: 14pt; }
    blockquote { border-left: 3pt solid #78350f; padding-left: 10pt; color: #44403c; }
    code { font-family: monospace; background: #f5f5f4; padding: 1pt 3pt; }
  </style>
</head>
<body>
  <h1>${escapeHtml(title)}</h1>
  <p class="meta">学习模式：${escapeHtml(modeLabel)}${sectionTitleZh ? ` · 关联章节：${escapeHtml(sectionTitleZh)}` : ''} · 导师模型：Gemini 4 Hydrogen</p>
  <div class="prompt-box">
    <p><strong>学习内容：</strong></p>
    <p>${escapeHtml(userPrompt).replace(/\n/g, '<br/>')}</p>
  </div>
  ${bodyChunks.join('\n  ')}
</body>
</html>`;
}
