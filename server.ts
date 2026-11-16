import 'dotenv/config';
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { GoogleGenAI, ThinkingLevel } from '@google/genai';
import { parseBookText } from './src/utils/bookParser';
import { generateEpubUint8Array } from './src/utils/epubGenerator';
import { buildTranslationBatches, parseTaggedTranslation } from './src/utils/translationAlign';
import { SECTION_META_ZH, SEED_TRANSLATIONS } from './src/data/pretranslatedBook';
import type { BookData, TranslationMap } from './src/types/book';

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
      res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.write(`data: ${JSON.stringify({ type: 'done', sectionId, translations: existing })}\n\n`);
      res.end();
      return;
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
      res.status(400).json({
        error: '尚未配置有效的 GEMINI_API_KEY，请在 Settings > Secrets 中配置密钥后即可实时翻译其余章节。',
      });
      return;
    }

    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

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
        const batch = batches[bIdx];
        const promptBody = batch.items
          .map((item) => `[P${item.idx}] (${item.kind}) ${item.text}`)
          .join('\n\n');

        const prompt = `请翻译《${book.titleZh}》（${book.titleEn}）的章节「${section.titleZh}（${section.titleEn}）」中的以下段落（第 ${bIdx + 1}/${batches.length} 批）。请严格保留 [P数字] 标签，不要输出 (body) 等类型标注：\n\n${promptBody}`;

        const stream = await ai.models.generateContentStream({
          model: 'gemini-4-hydrogen',
          contents: prompt,
          config: {
            systemInstruction: SYSTEM_INSTRUCTION,
            thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          },
        });

        let batchRaw = '';
        for await (const chunk of stream) {
          const piece = chunk.text ?? '';
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
        }

        const finalBatchParsed = parseTaggedTranslation(batchRaw, batch.items);
        Object.assign(accumulated, finalBatchParsed);
        saveSectionCache(sectionId, accumulated);
      }

      saveSectionCache(sectionId, accumulated);
      res.write(`data: ${JSON.stringify({ type: 'done', sectionId, translations: accumulated })}\n\n`);
      res.end();
    } catch (err) {
      const message = err instanceof Error ? err.message : '翻译请求失败，请稍后重试。';
      res.write(`data: ${JSON.stringify({ type: 'error', message })}\n\n`);
      res.end();
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
