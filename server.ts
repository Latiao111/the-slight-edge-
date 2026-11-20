import 'dotenv/config';
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import { parseBookText } from './src/utils/bookParser';
import { generateEpubUint8Array } from './src/utils/epubGenerator';
import { buildTranslationBatches, parseTaggedTranslation } from './src/utils/translationAlign';
import {
  buildStudyNoteFilename,
  buildStudyNoteMarkdownDocument,
  buildTeacherSystemInstruction,
  pickBestDriveTemplate,
  sanitizeChatHistory,
  type DriveFileCandidate,
  type DriveTemplateInfo,
} from './src/utils/teacherBot';
import {
  FALLBACK_GEMINI_MODEL,
  formatGeminiErrorMessage,
  PRIMARY_GEMINI_MODEL,
  runWithGeminiRetryAndFallback,
} from './src/utils/geminiRetry';
import { SECTION_META_ZH, SEED_TRANSLATIONS } from './src/data/pretranslatedBook';
import type { BookData, ChapterQuizQuestion, TeacherMode, TranslationMap } from './src/types/book';

const BOOK_FILE_PATH = path.resolve(
  process.cwd(),
  'public/assets/aistudio/The_Slight_Edge__Turning_Simple_-_Olson__Jeff_e727ea6b.txt'
);
const CACHE_DIR = path.resolve(process.cwd(), '.cache/translations');

let cachedBook: BookData | null = null;

function loadBook(): BookData {
  if (!cachedBook) {
    const raw = fs.readFileSync(BOOK_FILE_PATH, 'utf8');
    cachedBook = parseBookText(raw, SECTION_META_ZH);
  }
  return cachedBook;
}

function loadMergedTranslations(): TranslationMap {
  const merged: TranslationMap = {};
  for (const [secId, map] of Object.entries(SEED_TRANSLATIONS)) {
    merged[secId] = { ...map };
  }
  if (fs.existsSync(CACHE_DIR)) {
    const files = fs.readdirSync(CACHE_DIR).filter((f) => f.endsWith('.json'));
    for (const file of files) {
      const secId = file.replace(/\.json$/, '');
      try {
        const content = JSON.parse(fs.readFileSync(path.join(CACHE_DIR, file), 'utf8'));
        if (content && typeof content === 'object') {
          merged[secId] = { ...(merged[secId] ?? {}), ...content };
        }
      } catch {
        // Ignore corrupted cache files
      }
    }
  }
  return merged;
}

function saveSectionCache(sectionId: string, sectionMap: Record<string, string>) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  fs.writeFileSync(
    path.join(CACHE_DIR, `${sectionId}.json`),
    JSON.stringify(sectionMap, null, 2),
    'utf8'
  );
}

const SYSTEM_INSTRUCTION = `你是一位资深非虚构畅销书文学翻译家，正在将杰夫·奥尔森（Jeff Olson）与约翰·大卫·曼恩（John David Mann）合著的经典著作《The Slight Edge》（第八周年纪念版）完整翻译为流畅、地道、富有感染力的简体中文。

核心术语统一规范：
- The Slight Edge / slight edge → 微小的优势
- simple daily disciplines → 简单的日常自律
- simple errors in judgment → 微小的判断失误
- easy to do, easy not to do → 做起来容易，不做也容易
- compound interest / compounding effect → 复利效应
- Personal Stories from The Slight Edge Readers → 来自《微小的优势》读者的真实故事
- Essential Points from Chapter N → 第 N 章核心要点
- Beach Bum → 沙滩流浪汉
- Day of Disgust → 厌倦透顶的那一天
- Night of Despair → 陷入绝望的那个夜晚
- Mastermind → 智囊团
- Ripple Effect → 涟漪效应
- Happy Habits → 幸福微习惯

输出格式铁律：
1. 输入文本按段落编号为 [P0]、[P1]、[P2]……
2. 你必须严格保留完全一致的 [P数字] 标签作为每段译文的开头，段落之间空一行。
3. 绝不合并、拆分或遗漏任何段落编号；不要输出任何额外解释、序跋或 Markdown 代码块包裹。
4. 译文文风应自然晓畅、保留原作者亲切而富有哲理的口语叙事质感与节奏感。`;

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/book', (_req, res) => {
    try {
      const book = loadBook();
      const translations = loadMergedTranslations();
      res.json({ book, translations });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : '读取原著文本失败。',
      });
    }
  });

  app.get('/api/export/epub', async (req, res) => {
    try {
      const book = loadBook();
      const translations = loadMergedTranslations();
      const mode = req.query.mode === 'bilingual' ? 'bilingual' : 'zh';
      const onlyTranslated = req.query.onlyTranslated !== 'false';
      const { data, filename } = await generateEpubUint8Array(
        book,
        translations,
        mode,
        onlyTranslated
      );
      res.setHeader('Content-Type', 'application/epub+zip');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`
      );
      res.send(Buffer.from(data));
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : '生成 EPUB 电子书失败。',
      });
    }
  });

  function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`${label} timeout after ${timeoutMs}ms`));
      }, timeoutMs);
      promise.then(
        (val) => {
          clearTimeout(timer);
          resolve(val);
        },
        (err) => {
          clearTimeout(timer);
          reject(err);
        }
      );
    });
  }

  function initSseStream(res: express.Response): { isClosed: () => boolean; keepalive: () => void } {
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();
    res.write(': connected\n\n');

    let closed = false;
    res.on('close', () => {
      if (!res.writableEnded) {
        closed = true;
      }
    });

    return {
      isClosed: () => closed || res.writableEnded,
      keepalive: () => {
        if (!closed && !res.writableEnded) {
          res.write(': keepalive\n\n');
        }
      },
    };
  }

  app.post('/api/translate', async (req, res) => {
    const { sectionId, force } = req.body as { sectionId?: string; force?: boolean };
    if (!sectionId) {
      res.status(400).json({ error: '缺少 sectionId 参数。' });
      return;
    }

    const book = loadBook();
    const section = book.sections.find((s) => s.id === sectionId);
    if (!section) {
      res.status(404).json({ error: `未找到章节：${sectionId}` });
      return;
    }

    const existing = loadMergedTranslations()[sectionId] ?? {};
    if (!force && section.paragraphs.every((p) => existing[p.id]?.trim())) {
      const sse = initSseStream(res);
      if (!sse.isClosed()) {
        res.write(`data: ${JSON.stringify({ type: 'done', sectionId, translations: existing })}\n\n`);
        res.end();
      }
      return;
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
      res.status(400).json({
        error: '尚未配置有效的 GEMINI_API_KEY，请在 Settings > Secrets 中配置密钥后即可实时翻译其余章节。',
      });
      return;
    }

    const sse = initSseStream(res);

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    const targetParagraphs = force
      ? section.paragraphs
      : section.paragraphs.filter((p) => !existing[p.id]?.trim());
    const batches = buildTranslationBatches(targetParagraphs, 5200);
    const accumulated: Record<string, string> = force ? {} : { ...existing };

    try {
      for (let bIdx = 0; bIdx < batches.length; bIdx++) {
        if (sse.isClosed()) break;
        const batch = batches[bIdx];
        const promptBody = batch.items
          .map((item) => `[P${item.idx}] (${item.kind}) ${item.text}`)
          .join('\n\n');

        const prompt = `请翻译《${book.titleZh}》（${book.titleEn}）的章节「${section.titleZh}（${section.titleEn}）」中的以下段落（第 ${bIdx + 1}/${batches.length} 批）。请严格保留 [P数字] 标签，不要输出 (body) 等类型标注：\n\n${promptBody}`;

        await runWithGeminiRetryAndFallback({
          primaryModel: PRIMARY_GEMINI_MODEL,
          fallbackModel: FALLBACK_GEMINI_MODEL,
          primaryAttempts: 2,
          fallbackAttempts: 2,
          baseDelayMs: 900,
          shouldCancel: sse.isClosed,
          onRetryWait: () => sse.keepalive(),
          execute: async ({ model }) => {
            const config: {
              systemInstruction: string;
              thinkingConfig?: { thinkingLevel: ThinkingLevel };
            } = {
              systemInstruction: SYSTEM_INSTRUCTION,
            };
            if (model === PRIMARY_GEMINI_MODEL) {
              config.thinkingConfig = { thinkingLevel: ThinkingLevel.LOW };
            }

            const stream = await withTimeout(
              ai.models.generateContentStream({
                model,
                contents: prompt,
                config,
              }),
              9000,
              'Gemini translate stream open'
            );

            const iter = stream[Symbol.asyncIterator]();
            let firstStep = await withTimeout(iter.next(), 9000, 'Gemini translate first chunk');
            let batchRaw = '';

            while (!firstStep.done) {
              if (sse.isClosed()) break;
              const piece = firstStep.value?.text ?? '';
              if (piece) {
                batchRaw += piece;
                const parsed = parseTaggedTranslation(batchRaw, batch.items);
                Object.assign(accumulated, parsed);
                res.write(
                  `data: ${JSON.stringify({
                    type: 'chunk',
                    sectionId,
                    batchIndex: bIdx,
                    totalBatches: batches.length,
                    translations: parsed,
                  })}\n\n`
                );
              }
              firstStep = await withTimeout(iter.next(), 25000, 'Gemini translate next chunk');
            }

            const finalBatchParsed = parseTaggedTranslation(batchRaw, batch.items);
            Object.assign(accumulated, finalBatchParsed);
            saveSectionCache(sectionId, accumulated);
          },
        });
      }

      saveSectionCache(sectionId, accumulated);
      if (!sse.isClosed()) {
        res.write(`data: ${JSON.stringify({ type: 'done', sectionId, translations: accumulated })}\n\n`);
        res.end();
      }
    } catch (err) {
      saveSectionCache(sectionId, accumulated);
      const message = formatGeminiErrorMessage(err, 'translate');
      if (!sse.isClosed()) {
        res.write(`data: ${JSON.stringify({ type: 'error', message })}\n\n`);
        res.end();
      }
    }
  });

  function extractBearerToken(req: express.Request): string | null {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) return null;
    const token = header.slice(7).trim();
    return token.length > 0 ? token : null;
  }

  async function readDriveFileText(
    file: DriveFileCandidate,
    accessToken: string
  ): Promise<string> {
    if (file.mimeType === 'application/vnd.google-apps.document') {
      const exportRes = await fetch(
        `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(file.id)}/export?mimeType=text/plain`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      if (exportRes.ok) return (await exportRes.text()).trim();
    } else if (file.mimeType === 'application/vnd.google-apps.spreadsheet') {
      const exportRes = await fetch(
        `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(file.id)}/export?mimeType=text/csv`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      if (exportRes.ok) return (await exportRes.text()).trim();
    } else if (
      file.mimeType?.startsWith('text/') ||
      file.mimeType === 'application/json' ||
      file.name?.endsWith('.md') ||
      file.name?.endsWith('.txt')
    ) {
      const mediaRes = await fetch(
        `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(file.id)}?alt=media`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      if (mediaRes.ok) return (await mediaRes.text()).trim();
    }
    return '';
  }

  async function lookupDriveTemplate(
    key: 'vocab' | 'article',
    targetName: string,
    accessToken: string
  ): Promise<DriveTemplateInfo> {
    const safeName = targetName.replace(/'/g, "\\'");
    const q = encodeURIComponent(`trashed = false and name contains '${safeName}'`);
    const searchUrl = `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name,mimeType,parents,modifiedTime,webViewLink)&orderBy=modifiedTime desc&pageSize=15`;
    const searchRes = await fetch(searchUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (searchRes.status === 401) {
      throw new Error('DRIVE_UNAUTHORIZED');
    }
    if (!searchRes.ok) {
      const errText = await searchRes.text().catch(() => '');
      throw new Error(`Drive search failed (${searchRes.status}): ${errText}`);
    }

    const data = (await searchRes.json()) as { files?: DriveFileCandidate[] };
    const candidates = data.files ?? [];
    const best = pickBestDriveTemplate(candidates, targetName);
    if (!best) {
      return { key, targetName, found: false };
    }

    const isFolder = best.mimeType === 'application/vnd.google-apps.folder';
    if (isFolder) {
      const childQ = encodeURIComponent(`'${best.id}' in parents and trashed = false`);
      const childUrl = `https://www.googleapis.com/drive/v3/files?q=${childQ}&fields=files(id,name,mimeType,parents,modifiedTime,webViewLink)&orderBy=modifiedTime desc&pageSize=10`;
      const childRes = await fetch(childUrl, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      let sampleContent = '';
      if (childRes.ok) {
        const childData = (await childRes.json()) as { files?: DriveFileCandidate[] };
        const sampleFile = (childData.files ?? []).find(
          (f) => f.mimeType !== 'application/vnd.google-apps.folder'
        );
        if (sampleFile) {
          sampleContent = await readDriveFileText(sampleFile, accessToken);
        }
      }
      return {
        key,
        targetName,
        found: true,
        fileId: best.id,
        name: best.name,
        mimeType: best.mimeType,
        isFolder: true,
        folderId: best.id,
        webViewLink: best.webViewLink,
        sampleContent,
      };
    }

    const sampleContent = await readDriveFileText(best, accessToken);
    return {
      key,
      targetName,
      found: true,
      fileId: best.id,
      name: best.name,
      mimeType: best.mimeType,
      isFolder: false,
      folderId: best.parents?.[0],
      webViewLink: best.webViewLink,
      sampleContent,
    };
  }

  async function findOrCreateAppStudyFolder(
    folderName: string,
    accessToken: string
  ): Promise<string | null> {
    try {
      const safeName = folderName.replace(/'/g, "\\'");
      const q = encodeURIComponent(
        `trashed = false and mimeType = 'application/vnd.google-apps.folder' and name = '${safeName}'`
      );
      const listRes = await fetch(
        `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name)&pageSize=5`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      if (listRes.ok) {
        const listData = (await listRes.json()) as { files?: { id: string; name: string }[] };
        if (listData.files && listData.files.length > 0) {
          return listData.files[0].id;
        }
      }

      const createRes = await fetch('https://www.googleapis.com/drive/v3/files?fields=id', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: folderName,
          mimeType: 'application/vnd.google-apps.folder',
        }),
      });
      if (createRes.ok) {
        const created = (await createRes.json()) as { id?: string };
        return created.id ?? null;
      }
    } catch {
      // Fallback to root if folder creation fails
    }
    return null;
  }

  async function uploadMarkdownFileMultipart(params: {
    accessToken: string;
    filename: string;
    markdownBody: string;
    parentId?: string | null;
  }) {
    const { accessToken, filename, markdownBody, parentId } = params;
    const boundary = `slight_edge_md_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const metadata = JSON.stringify({
      name: filename,
      mimeType: 'text/markdown',
      ...(parentId ? { parents: [parentId] } : {}),
    });

    const body = [
      `--${boundary}`,
      'Content-Type: application/json; charset=UTF-8',
      '',
      metadata,
      `--${boundary}`,
      'Content-Type: text/markdown; charset=UTF-8',
      '',
      markdownBody,
      `--${boundary}--`,
    ].join('\r\n');

    return fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink,mimeType',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': `multipart/related; boundary=${boundary}`,
        },
        body,
      }
    );
  }

  app.get('/api/drive/templates', async (req, res) => {
    const token = extractBearerToken(req);
    if (!token) {
      res.status(401).json({ error: '请先登录 Google 账号以访问云端硬盘模板。' });
      return;
    }

    try {
      const [vocabTemplate, articleTemplate] = await Promise.all([
        lookupDriveTemplate('vocab', '学单词', token),
        lookupDriveTemplate('article', '英语文章学习', token),
      ]);
      res.json({ vocabTemplate, articleTemplate });
    } catch (err) {
      if (err instanceof Error && err.message === 'DRIVE_UNAUTHORIZED') {
        res.status(401).json({ error: 'Google 授权已过期，请重新登录连接云端硬盘。' });
        return;
      }
      res.status(500).json({
        error: err instanceof Error ? err.message : '读取 Google 云端硬盘学习模板失败。',
      });
    }
  });

  app.post('/api/drive/file', async (req, res) => {
    const token = extractBearerToken(req);
    if (!token) {
      res.status(401).json({ error: '请先登录 Google 账号后再从云端硬盘读取文档。' });
      return;
    }

    const { fileId, name, mimeType, parentId, webViewLink } = req.body as {
      fileId?: string;
      name?: string;
      mimeType?: string;
      parentId?: string;
      webViewLink?: string;
    };

    if (!fileId || !fileId.trim()) {
      res.status(400).json({ error: '缺少所选云端文档的 fileId。' });
      return;
    }

    try {
      const metaRes = await fetch(
        `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId.trim())}?fields=id,name,mimeType,parents,webViewLink`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (metaRes.status === 401) {
        res.status(401).json({ error: 'Google 授权已过期，请重新登录连接云端硬盘。' });
        return;
      }

      let meta: DriveFileCandidate = {
        id: fileId.trim(),
        name: name || '云端文档',
        mimeType: mimeType || '',
        parents: parentId ? [parentId] : undefined,
        webViewLink,
      };

      if (metaRes.ok) {
        const fetched = (await metaRes.json()) as DriveFileCandidate;
        meta = {
          ...meta,
          ...fetched,
        };
      }

      const isFolder = meta.mimeType === 'application/vnd.google-apps.folder';
      let content = '';
      if (isFolder) {
        const childQ = encodeURIComponent(`'${meta.id}' in parents and trashed = false`);
        const childRes = await fetch(
          `https://www.googleapis.com/drive/v3/files?q=${childQ}&fields=files(id,name,mimeType,parents,modifiedTime,webViewLink)&orderBy=modifiedTime desc&pageSize=10`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (childRes.ok) {
          const childData = (await childRes.json()) as { files?: DriveFileCandidate[] };
          const sampleFile = (childData.files ?? []).find(
            (f) => f.mimeType !== 'application/vnd.google-apps.folder'
          );
          if (sampleFile) {
            content = await readDriveFileText(sampleFile, token);
          }
        }
      } else {
        content = await readDriveFileText(meta, token);
      }

      res.json({
        file: {
          id: meta.id,
          name: meta.name || '云端文档',
          mimeType: meta.mimeType || '',
          isFolder,
          folderId: isFolder ? meta.id : meta.parents?.[0],
          webViewLink: meta.webViewLink || webViewLink,
          content,
        },
      });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : '读取所选 Google 云端硬盘文档失败。',
      });
    }
  });

  app.post('/api/drive/save', async (req, res) => {
    const token = extractBearerToken(req);
    if (!token) {
      res.status(401).json({ error: '未提供 Google 访问令牌，无法保存至云端硬盘。' });
      return;
    }

    const { mode, userPrompt, markdownContent, targetFolderId, sectionTitleZh, sectionTitleEn } =
      req.body as {
        mode?: TeacherMode;
        userPrompt?: string;
        markdownContent?: string;
        targetFolderId?: string;
        sectionTitleZh?: string;
        sectionTitleEn?: string;
      };

    if (!markdownContent || !markdownContent.trim()) {
      res.status(400).json({ error: '缺少待保存的学习笔记内容。' });
      return;
    }

    const safeMode: TeacherMode =
      mode === 'article' || mode === 'explore' ? mode : 'vocab';
    const now = new Date();
    const filename = buildStudyNoteFilename(safeMode, userPrompt || '课堂笔记', now);
    const markdownBody = buildStudyNoteMarkdownDocument({
      mode: safeMode,
      userPrompt: userPrompt || '',
      markdownContent,
      sectionTitleZh,
      sectionTitleEn,
      date: now,
    });

    try {
      let uploadRes = await uploadMarkdownFileMultipart({
        accessToken: token,
        filename,
        markdownBody,
        parentId: targetFolderId || null,
      });

      // Under drive.file least-privilege, writing inside an existing folder not created
      // by this app may return 403/404; seamlessly fall back to an app-owned folder.
      if (!uploadRes.ok && targetFolderId && (uploadRes.status === 403 || uploadRes.status === 404)) {
        const fallbackFolderName =
          safeMode === 'vocab'
            ? '学单词 · Markdown 笔记'
            : safeMode === 'explore'
            ? '延伸研学 · Markdown 笔记'
            : '英语文章学习 · Markdown 笔记';
        const appFolderId = await findOrCreateAppStudyFolder(fallbackFolderName, token);
        uploadRes = await uploadMarkdownFileMultipart({
          accessToken: token,
          filename,
          markdownBody,
          parentId: appFolderId,
        });
      }

      if (uploadRes.status === 401) {
        res.status(401).json({ error: 'Google 授权已过期，请重新登录后保存。' });
        return;
      }

      if (!uploadRes.ok) {
        const errBody = await uploadRes.text().catch(() => '');
        res.status(uploadRes.status).json({
          error: `保存 .md 至 Google 云端硬盘失败 (${uploadRes.status}): ${errBody.slice(0, 200)}`,
        });
        return;
      }

      const savedFile = (await uploadRes.json()) as {
        id: string;
        name: string;
        webViewLink?: string;
        mimeType?: string;
      };
      res.json({ file: savedFile });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : '后台保存 .md 至 Google 云端硬盘时出现网络错误。',
      });
    }
  });

  app.post('/api/teacher/chat', async (req, res) => {
    const { mode, message, history, template, sectionTitleZh, sectionTitleEn } = req.body as {
      mode?: TeacherMode;
      message?: string;
      history?: unknown;
      template?: DriveTemplateInfo | null;
      sectionTitleZh?: string;
      sectionTitleEn?: string;
    };

    if (!message || typeof message !== 'string' || !message.trim()) {
      res.status(400).json({ error: '请输入需要学习的单词、短语或英语句段。' });
      return;
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
      res.status(400).json({
        error: '尚未配置有效的 GEMINI_API_KEY，请在 Settings > Secrets 中配置密钥后即可启用英语老师助手。',
      });
      return;
    }

    const safeMode: TeacherMode =
      mode === 'article' || mode === 'explore' ? mode : 'vocab';
    const cleanHistory = sanitizeChatHistory(history).map((turn) => ({
      role: turn.role,
      parts: [{ text: turn.text }],
    }));

    const systemInstruction = buildTeacherSystemInstruction({
      mode: safeMode,
      template: template ?? null,
      sectionTitleZh,
      sectionTitleEn,
    });

    const sse = initSseStream(res);

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    try {
      let fullText = '';
      await runWithGeminiRetryAndFallback({
        primaryModel: PRIMARY_GEMINI_MODEL,
        fallbackModel: FALLBACK_GEMINI_MODEL,
        primaryAttempts: 2,
        fallbackAttempts: 2,
        baseDelayMs: 900,
        shouldCancel: () => sse.isClosed() || fullText.length > 0,
        onRetryWait: () => sse.keepalive(),
        execute: async ({ model }) => {
          const config: {
            systemInstruction: string;
            thinkingConfig?: { thinkingLevel: ThinkingLevel };
          } = {
            systemInstruction,
          };
          if (model === PRIMARY_GEMINI_MODEL) {
            config.thinkingConfig = { thinkingLevel: ThinkingLevel.LOW };
          }

          const chat = ai.chats.create({
            model,
            history: cleanHistory,
            config,
          });

          const stream = await withTimeout(
            chat.sendMessageStream({ message: message.trim() }),
            9000,
            'Gemini teacher stream open'
          );

          const iter = stream[Symbol.asyncIterator]();
          let step = await withTimeout(iter.next(), 9000, 'Gemini teacher first chunk');
          while (!step.done) {
            if (sse.isClosed()) break;
            const piece = step.value?.text ?? '';
            if (piece) {
              fullText += piece;
              res.write(`data: ${JSON.stringify({ type: 'chunk', text: piece })}\n\n`);
            }
            step = await withTimeout(iter.next(), 25000, 'Gemini teacher next chunk');
          }
        },
      });

      if (!sse.isClosed()) {
        res.write(`data: ${JSON.stringify({ type: 'done', fullText })}\n\n`);
        res.end();
      }
    } catch (err) {
      const errMsg = formatGeminiErrorMessage(err, 'teacher');
      if (!sse.isClosed()) {
        res.write(`data: ${JSON.stringify({ type: 'error', message: errMsg })}\n\n`);
        res.end();
      }
    }
  });

  app.post('/api/study/quiz', async (req, res) => {
    const { sectionId } = req.body as { sectionId?: string };
    if (!sectionId) {
      res.status(400).json({ error: '缺少章节标识 sectionId。' });
      return;
    }

    const book = loadBook();
    const section = book.sections.find((s) => s.id === sectionId);
    if (!section) {
      res.status(404).json({ error: `未找到章节：${sectionId}` });
      return;
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
      res.status(400).json({
        error: '尚未配置有效的 GEMINI_API_KEY，无法生成本章理解自测题。',
      });
      return;
    }

    const mergedTrans = loadMergedTranslations()[sectionId] ?? {};
    const excerptParts: string[] = [];
    if (section.essentialPointsZh && section.essentialPointsZh.length > 0) {
      excerptParts.push(`【本章核心要点】\n${section.essentialPointsZh.map((p, i) => `${i + 1}. ${p}`).join('\n')}`);
    }

    let charBudget = 4200;
    const bodySnippets: string[] = [];
    for (const p of section.paragraphs) {
      const piece = (mergedTrans[p.id] || p.text || '').trim();
      if (!piece) continue;
      if (charBudget - piece.length < 0 && bodySnippets.length >= 6) break;
      bodySnippets.push(piece);
      charBudget -= piece.length;
    }
    excerptParts.push(`【本章正文节选】\n${bodySnippets.join('\n\n')}`);

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    const quizPrompt = `你是《微小的优势》（The Slight Edge）的深度阅读导师。请根据下面章节「${section.titleZh}（${section.titleEn}）」的内容，设计 3 道高质量简体中文单选题：
- 第 1 题考查本章最核心的观点或反直觉逻辑；
- 第 2 题考查本章的现实应用情景判断（给出一个贴近生活/学习/编程或职场的情境，判断哪种做法符合“微小的优势”）；
- 第 3 题考查本章核心理念与其他学科（如复利数学、心理学、习惯科学）或延伸概念的关联理解。

要求：
1. 每道题恰好提供 4 个区分度清晰、不敷衍的选项；
2. correctIndex 必须是 0~3 的整数，且 3 道题的正确答案位置不要全相同；
3. explanation 用 2~3 句简明清晰的话讲透为什么选这项，同时点出干扰项的常见认知误区；
4. relatedConcept 用简短中文词组写出该题对应的延伸学科概念（如“潜能蓄力平台”“积极心理学倒置公式”“基底核习惯回路”等）。

${excerptParts.join('\n\n')}`;

    try {
      const questions = await runWithGeminiRetryAndFallback<ChapterQuizQuestion[]>({
        primaryModel: PRIMARY_GEMINI_MODEL,
        fallbackModel: FALLBACK_GEMINI_MODEL,
        primaryAttempts: 2,
        fallbackAttempts: 2,
        baseDelayMs: 900,
        execute: async ({ model }) => {
          const config: {
            responseMimeType: string;
            responseSchema: Record<string, unknown>;
            thinkingConfig?: { thinkingLevel: ThinkingLevel };
          } = {
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                questions: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      question: { type: Type.STRING },
                      options: {
                        type: Type.ARRAY,
                        items: { type: Type.STRING },
                      },
                      correctIndex: { type: Type.INTEGER },
                      explanation: { type: Type.STRING },
                      relatedConcept: { type: Type.STRING },
                    },
                    required: ['question', 'options', 'correctIndex', 'explanation', 'relatedConcept'],
                  },
                },
              },
              required: ['questions'],
            },
          };
          if (model === PRIMARY_GEMINI_MODEL) {
            config.thinkingConfig = { thinkingLevel: ThinkingLevel.LOW };
          }

          const response = await withTimeout(
            ai.models.generateContent({
              model,
              contents: quizPrompt,
              config,
            }),
            16000,
            'Gemini quiz generation'
          );

          const rawText = response.text?.trim();
          if (!rawText) {
            throw new Error('模型未返回自测题目数据');
          }
          const parsed = JSON.parse(rawText) as { questions?: ChapterQuizQuestion[] };
          const list = Array.isArray(parsed.questions) ? parsed.questions : [];
          const normalized = list
            .filter(
              (q) =>
                q &&
                typeof q.question === 'string' &&
                Array.isArray(q.options) &&
                q.options.length >= 2 &&
                typeof q.correctIndex === 'number'
            )
            .slice(0, 3)
            .map((q) => ({
              question: q.question.trim(),
              options: q.options.slice(0, 4).map((o) => String(o).trim()),
              correctIndex: Math.max(0, Math.min(q.options.slice(0, 4).length - 1, Math.round(q.correctIndex))),
              explanation: String(q.explanation || '').trim(),
              relatedConcept: String(q.relatedConcept || '微小的优势').trim(),
            }));

          if (normalized.length === 0) {
            throw new Error('生成的题目结构不完整，请重试。');
          }
          return normalized;
        },
      });

      res.json({ sectionId, questions });
    } catch (err) {
      res.status(500).json({
        error: formatGeminiErrorMessage(err, 'teacher'),
      });
    }
  });

  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  const port = Number(process.env.PORT) || 3000;
  app.listen(port, '0.0.0.0', () => {
    console.log(`Server listening on http://localhost:${port}`);
  });
}

startServer();
