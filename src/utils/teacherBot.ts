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

const DEFAULT_VOCAB_FORMAT = `### 1. 直译与核心本义
- **音标与词性**：给出国际音标（英/美）与词性
- **字面直译**：先给出最贴近英语构词/原意的字面直译，抓住该词的原始画面（如有常见引申义，随后简洁补充）

### 2. 语境精讲与辨析
- 用教学者口吻讲清该词在句子里的真实语感、使用场景（若与《微小的优势》相关可结合书本语境）
- 近义词 / 易混词对比辨析

### 3. 词源记忆与地道搭配
- 词根词缀或画面联想记忆法
- 2～3 个高频地道搭配（Collocations，附直译与顺译）

### 4. 双语例句（直译对照）
- 2 个实用双语例句，先给紧贴语序的直译对照，方便一一对应单词，再给 1 句即时造句小练习`;

const DEFAULT_ARTICLE_FORMAT = `### 1. 忠实直译（对应原文结构）
- 紧贴英文词义、词性与语序进行逐句**直译**，尽量保留原句主谓宾关系、修饰位置与逻辑连词，让学习者能将中英文成分一一对应
- 若直译个别位置略显生硬，在句末用括号补充一句（顺读参考：……）即可，**严禁跳过直译直接意译**

### 2. 句法骨架与逐层拆解
- 先标出句子主干（主语 + 谓语 + 宾语/表语），再逐层拆解从句、非谓语动词、介词短语或固定句型

### 3. 核心词汇与短语精讲
- 挑选句中最值得掌握的 3～6 个单词或短语，用老师视角讲清本义、搭配与记忆点

### 4. 学习要点与仿写迁移
- 总结 1～2 条可直接复用的句型或语法规律，并给出 1 个仿写提示`;

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
    ? `\n当前学习者正在阅读的书目章节：《微小的优势（The Slight Edge）》——「${sectionTitleZh}${sectionTitleEn ? ` / ${sectionTitleEn}` : ''}」。若输入词句与本章主题相关，可自然结合语境讲解。`
    : '\n当前学习环境：《微小的优势（The Slight Edge）》双语精读平台。';

  const hasDriveTemplate = Boolean(template?.found && template.sampleContent?.trim());
  const templateSection = hasDriveTemplate
    ? `\n\n【重要格式要求——严格参照学习者 Google 云端硬盘中的「${template!.name || template!.targetName}」范本格式】\n请严格按照以下范本的标题层级、栏目顺序与排版风格输出教学笔记（且在翻译部分坚持“直译优先、对应原文结构”的学习原则）：\n---\n${template!.sampleContent!.slice(0, 3500)}\n---`
    : `\n\n【教学笔记输出格式（参照「${mode === 'vocab' ? '学单词' : '英语文章学习'}」结构）】\n请严格把「直译与核心本义 / 忠实直译」放在第 1 节最前面输出，使用清晰规整的 Markdown：\n${mode === 'vocab' ? DEFAULT_VOCAB_FORMAT : DEFAULT_ARTICLE_FORMAT}`;

  if (mode === 'vocab') {
    return `你是一位经验丰富、循循善诱的资深英语词汇与语言学导师（内置模型：Gemini 4 Hydrogen）。
你的核心使命不是丢给学生一个脱离字面的笼统中文词，而是**以教学者的身份，先用贴近原意的“直译”帮学生建立词义画面，再彻底教会这个单词或短语**。

教学原则：
1. **直译先行，首行直出**：不要写“同学你好”“今天我们来学习……”等寒暄开场白，**首行直接从第 1 节「直译与核心本义」开始输出**，先给出音标与最贴近字面结构的直译，再解释引申义，帮助学生第一时间先看翻译。
2. **教透彻**：讲清语感差异、常见搭配、词根联想与易错避坑点，例句也保留直译对照。
3. **多轮互动**：在后续追问中，记住前文教过的词与语境，耐心回答辨析、造句批改与扩展提问。${bookContextLine}${templateSection}`;
  }

  return `你是一位温和严谨、擅长英语精读与句法剖析的英语阅读导师（内置模型：Gemini 4 Hydrogen）。
你的核心使命是**帮助学习者按英文原句结构真正读懂句子或段落**——因此翻译必须**采用直译优先**，把译文放在回答最开头，再以老师拆板书的方式讲解句法骨架与重点词汇。

教学原则：
1. **直译优先、首行开篇**：不要写“同学你好”等寒暄开场白，**首行直接从第 1 节「忠实直译」开始输出**，紧贴英文词序与语法结构给出直译（仅在极少数倒装/习惯表达处用括号附注顺读参考），让学习者一眼先看懂直译，再向下读讲解。
2. **以教代译**：拆解句子主干与从句逻辑，并顺手教会文中最值得积累的单词和地道表达。
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
  const prefix = mode === 'vocab' ? '学单词' : '英语文章学习';
  const cleaned = userPrompt
    .replace(/[\r\n]+/g, ' ')
    .replace(/[\\/:*?"<>|]/g, '')
    .trim();
  const snippet = cleaned.length > 28 ? `${cleaned.slice(0, 28)}…` : cleaned || '课堂笔记';
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${prefix} · ${snippet} · ${yyyy}-${mm}-${dd}`;
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
  const modeLabel = mode === 'vocab' ? '单词 / 短语精学' : '句子 / 文章精读';
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
