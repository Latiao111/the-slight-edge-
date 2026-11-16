import JSZip from 'jszip';
import type { BookData, BookParagraph, BookSection, ReadingMode, TranslationMap } from '../types/book';
import { getSectionTranslationStats } from './translationAlign';

export interface EpubFileEntry {
  path: string;
  content: string;
  store?: boolean;
}

export interface EpubPackage {
  filename: string;
  files: EpubFileEntry[];
  includedSections: BookSection[];
}

export function escapeXml(input: string): string {
  // Strip invalid XML 1.0 control characters except \t, \n, \r
  const cleaned = input.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g, '');
  return cleaned
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function toOpfId(sectionId: string): string {
  return `sec_${sectionId.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
}

export function getIncludedEpubSections(
  book: BookData,
  translations: TranslationMap,
  includeOnlyTranslated: boolean
): BookSection[] {
  if (!includeOnlyTranslated) {
    return book.sections;
  }
  const filtered = book.sections.filter(
    (s) => getSectionTranslationStats(s, translations).translated > 0
  );
  return filtered.length > 0 ? filtered : book.sections;
}

function renderBookCss(): string {
  return `@charset "UTF-8";

body {
  font-family: "Noto Serif SC", "Songti SC", "SimSun", Georgia, serif;
  line-height: 1.8;
  color: #1c1917;
  background-color: #fbf9f5;
  margin: 0;
  padding: 1.2em 1.4em;
}

h1, h2, h3 {
  font-weight: 600;
  color: #1c1917;
  line-height: 1.35;
}

.part-kicker {
  font-size: 0.78em;
  letter-spacing: 0.14em;
  color: #78350f;
  margin-bottom: 0.4em;
}

.chapter-title {
  font-size: 1.65em;
  margin: 0 0 0.25em 0;
}

.chapter-subtitle {
  font-size: 0.92em;
  font-style: italic;
  color: #57534e;
  margin: 0 0 1.4em 0;
  padding-bottom: 0.9em;
  border-bottom: 1px solid #d6cebe;
}

blockquote.epigraph {
  margin: 1.2em 0 1.8em 0;
  padding: 0.9em 1.1em;
  border-top: 1px solid #d6cebe;
  border-bottom: 1px solid #d6cebe;
  text-align: center;
  background-color: #f3efe6;
}

blockquote.epigraph p {
  margin: 0.3em 0;
  font-style: italic;
  text-indent: 0;
}

blockquote.epigraph .epigraph-en {
  font-size: 0.88em;
  color: #57534e;
}

blockquote.epigraph .epigraph-attr {
  font-size: 0.8em;
  color: #78716c;
  font-style: normal;
  margin-top: 0.6em;
}

h2.subheading {
  font-size: 1.2em;
  margin: 1.8em 0 0.7em 0;
  padding-top: 0.8em;
  border-top: 1px solid #e7e2d8;
}

h2.subheading .subheading-en {
  display: block;
  font-size: 0.76em;
  font-weight: 400;
  font-style: italic;
  color: #57534e;
  margin-top: 0.2em;
}

p.prose {
  margin: 0 0 0.95em 0;
  text-align: justify;
}

p.en-parallel {
  margin: -0.45em 0 1.2em 0;
  font-size: 0.9em;
  line-height: 1.65;
  color: #57534e;
  font-style: italic;
  padding-bottom: 0.65em;
  border-bottom: 1px solid #ece7de;
}

p.en-fallback {
  margin: 0 0 0.95em 0;
  color: #57534e;
}

div.essential-item {
  margin: 0 0 0.75em 0;
  padding: 0.55em 0.8em;
  background-color: #f3efe6;
  border: 1px solid #e7e2d8;
}

div.essential-item .item-num {
  font-weight: 600;
  color: #78350f;
  margin-right: 0.45em;
}

div.essential-item .item-en {
  margin-top: 0.35em;
  font-size: 0.88em;
  color: #57534e;
  font-style: italic;
}

figure.diagram {
  margin: 1.6em 0;
  padding: 0.9em;
  border: 1px solid #d6cebe;
  background-color: #f3efe6;
  text-align: center;
}

figure.diagram figcaption {
  margin-top: 0.6em;
  font-size: 0.82em;
  font-style: italic;
  color: #57534e;
}

.cover-page {
  text-align: center;
  padding: 3em 1.5em;
}

.cover-edition {
  font-size: 0.82em;
  letter-spacing: 0.16em;
  color: #78350f;
  margin-bottom: 1.4em;
}

.cover-title {
  font-size: 2.2em;
  margin: 0.2em 0;
}

.cover-title-en {
  font-size: 1.15em;
  font-style: italic;
  color: #78350f;
  margin: 0.3em 0 1em 0;
}

.cover-subtitle {
  font-size: 1.05em;
  color: #44403c;
  margin: 0 0 2em 0;
}

.cover-author {
  font-size: 0.92em;
  color: #57534e;
  margin-top: 2em;
  padding-top: 1.2em;
  border-top: 1px solid #d6cebe;
}

nav#toc ol {
  list-style: none;
  padding-left: 0;
}

nav#toc li {
  margin: 0.55em 0;
  padding-bottom: 0.45em;
  border-bottom: 1px solid #ece7de;
}

nav#toc a {
  color: #1c1917;
  text-decoration: none;
}
`;
}

function renderCoverSvg(book: BookData, mode: Extract<ReadingMode, 'zh' | 'bilingual'>): string {
  const modeLabel = mode === 'bilingual' ? '中英双语对照珍藏版' : '简体中文全本译注版';
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 840" width="600" height="840">
  <rect width="600" height="840" fill="#FBF9F5"/>
  <rect x="28" y="28" width="544" height="784" fill="#F3EFE6" stroke="#D6CEBE" stroke-width="2"/>
  <line x1="64" y1="108" x2="536" y2="108" stroke="#D6CEBE" stroke-width="1"/>
  <text x="300" y="84" text-anchor="middle" font-size="14" letter-spacing="3" fill="#78350F" font-family="serif">${escapeXml(book.editionZh)} · ${escapeXml(modeLabel)}</text>
  <text x="300" y="250" text-anchor="middle" font-size="54" font-weight="700" fill="#1C1917" font-family="serif">${escapeXml(book.titleZh)}</text>
  <text x="300" y="302" text-anchor="middle" font-size="24" font-style="italic" fill="#78350F" font-family="serif">${escapeXml(book.titleEn)}</text>
  <text x="300" y="356" text-anchor="middle" font-size="18" fill="#44403C" font-family="serif">${escapeXml(book.subtitleZh)}</text>
  <line x1="88" y1="490" x2="512" y2="490" stroke="#D6CEBE" stroke-width="1.5" stroke-dasharray="6 6"/>
  <path d="M 96 488 C 240 488, 380 462, 504 396" fill="none" stroke="#14532D" stroke-width="4"/>
  <path d="M 96 492 C 240 492, 380 518, 504 584" fill="none" stroke="#9A3412" stroke-width="3" stroke-dasharray="5 4"/>
  <circle cx="96" cy="490" r="6" fill="#78350F"/>
  <circle cx="504" cy="396" r="6" fill="#14532D"/>
  <text x="300" y="654" text-anchor="middle" font-size="15" fill="#57534E" font-family="serif">做起来容易，不做也容易——时间会放大每日微小选择</text>
  <line x1="64" y1="710" x2="536" y2="710" stroke="#D6CEBE" stroke-width="1"/>
  <text x="300" y="754" text-anchor="middle" font-size="16" fill="#1C1917" font-family="serif">${escapeXml(book.authorZh)}</text>
</svg>
`;
}

function renderCoverXhtml(book: BookData, mode: Extract<ReadingMode, 'zh' | 'bilingual'>): string {
  const modeLabel = mode === 'bilingual' ? '中英双语对照版' : '简体中文版';
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="zh-CN" lang="zh-CN">
<head>
  <meta charset="UTF-8"/>
  <title>《${escapeXml(book.titleZh)}》— 封面</title>
  <link rel="stylesheet" type="text/css" href="styles/book.css"/>
</head>
<body>
  <section class="cover-page">
    <p class="cover-edition">${escapeXml(book.editionZh)} · ${escapeXml(modeLabel)}</p>
    <h1 class="cover-title">《${escapeXml(book.titleZh)}》</h1>
    <p class="cover-title-en">${escapeXml(book.titleEn)}</p>
    <p class="cover-subtitle">${escapeXml(book.subtitleZh)}</p>
    <figure class="diagram">
      <img src="images/cover.svg" alt="《${escapeXml(book.titleZh)}》封面图" style="max-width: 100%; height: auto;"/>
    </figure>
    <p class="cover-author">${escapeXml(book.authorZh)}</p>
  </section>
</body>
</html>
`;
}

function renderInlineDiagramForParagraph(paragraphId: string): string {
  if (paragraphId === 'ch-1-p-60') {
    return `<figure class="diagram">
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 560 220" width="100%">
    <line x1="56" y1="44" x2="528" y2="44" stroke="#14532D" stroke-width="1.2" stroke-dasharray="5 4"/>
    <line x1="56" y1="112" x2="528" y2="112" stroke="#78350F" stroke-width="1.2" stroke-dasharray="4 4"/>
    <line x1="56" y1="180" x2="528" y2="180" stroke="#9A3412" stroke-width="1.2" stroke-dasharray="5 4"/>
    <text x="10" y="48" font-size="12" fill="#14532D" font-weight="600">成功线</text>
    <text x="10" y="116" font-size="12" fill="#78350F" font-weight="600">生存线</text>
    <text x="10" y="184" font-size="12" fill="#9A3412" font-weight="600">失败线</text>
    <path d="M 64 172 C 92 172, 108 102, 138 102 C 168 102, 184 170, 214 170 C 244 170, 260 100, 290 100 C 320 100, 336 168, 366 168" fill="none" stroke="#57534E" stroke-width="2"/>
    <path d="M 290 100 C 335 100, 395 72, 495 36" fill="none" stroke="#14532D" stroke-width="2.4"/>
    <circle cx="290" cy="100" r="4" fill="#78350F"/>
    <circle cx="495" cy="36" r="4.5" fill="#14532D"/>
  </svg>
  <figcaption>图 1 · 逃离“过山车诅咒”：把你带到生存线的行动，只要坚持做下去，就会把你带到成功线</figcaption>
</figure>`;
  }

  if (paragraphId === 'ch-10-p-21') {
    return `<figure class="diagram">
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 560 220" width="100%">
    <line x1="48" y1="110" x2="528" y2="110" stroke="#D6CEBE" stroke-width="1"/>
    <path d="M 56 108 C 190 108, 340 94, 512 24" fill="none" stroke="#14532D" stroke-width="2.5"/>
    <path d="M 56 112 C 190 112, 340 126, 512 196" fill="none" stroke="#9A3412" stroke-width="2.2" stroke-dasharray="5 3"/>
    <circle cx="56" cy="110" r="4" fill="#1C1917"/>
    <text x="64" y="98" font-size="11" fill="#57534E">起点几乎重叠，初期难以察觉差异</text>
    <text x="320" y="34" font-size="12" fill="#14532D" font-weight="600">5% 成功曲线（担当 · 面向未来）</text>
    <text x="315" y="196" font-size="12" fill="#9A3412" font-weight="600">95% 失败曲线（责怪 · 沉溺过去）</text>
  </svg>
  <figcaption>图 2 · 两条人生轨迹：日常微小选择的几何复利最终将两条曲线彻底拉开</figcaption>
</figure>`;
  }

  return '';
}

function renderParagraphXhtml(
  p: BookParagraph,
  idx: number,
  section: BookSection,
  secTrans: Record<string, string>,
  mode: Extract<ReadingMode, 'zh' | 'bilingual'>
): string {
  const zh = secTrans[p.id];

  if (p.kind === 'epigraph' || p.kind === 'attribution') {
    return '';
  }

  if (p.kind === 'subheading' || p.kind === 'story_header' || p.kind === 'essential_header') {
    const displayZh =
      zh ||
      (p.kind === 'story_header'
        ? '来自《微小的优势》读者的真实故事'
        : p.kind === 'essential_header' && section.chapterNumber
        ? `第 ${section.chapterNumber} 章核心要点`
        : undefined);

    if (mode === 'bilingual') {
      return `<h2 class="subheading">${escapeXml(displayZh || p.text)}${
        displayZh ? `<span class="subheading-en">${escapeXml(p.text)}</span>` : ''
      }</h2>`;
    }
    return `<h2 class="subheading">${escapeXml(displayZh || p.text)}</h2>`;
  }

  if (p.kind === 'essential_item') {
    const itemIdx = section.paragraphs
      .slice(0, idx)
      .filter((prev) => prev.kind === 'essential_item').length;
    const displayZh = zh || section.essentialPointsZh?.[itemIdx];
    const numStr = `0${itemIdx + 1}.`;

    if (mode === 'bilingual') {
      return `<div class="essential-item"><span class="item-num">${numStr}</span><span>${escapeXml(
        displayZh || '（待翻译）'
      )}</span><div class="item-en">${escapeXml(p.text)}</div></div>`;
    }
    return `<div class="essential-item"><span class="item-num">${numStr}</span><span>${escapeXml(
      displayZh || p.text
    )}</span></div>`;
  }

  // Standard body paragraph
  const diagram = renderInlineDiagramForParagraph(p.id);
  if (mode === 'bilingual') {
    const zhHtml = zh
      ? `<p class="prose">${escapeXml(zh)}</p>`
      : `<p class="prose" style="color:#78716c;font-style:italic;">（此段尚未翻译，当前附原文）</p>`;
    const enHtml = `<p class="en-parallel">${escapeXml(p.text)}</p>`;
    return `${zhHtml}\n${enHtml}${diagram ? `\n${diagram}` : ''}`;
  }

  const bodyHtml = zh
    ? `<p class="prose">${escapeXml(zh)}</p>`
    : `<p class="en-fallback">${escapeXml(p.text)}</p>`;
  return `${bodyHtml}${diagram ? `\n${diagram}` : ''}`;
}

function renderSectionXhtml(
  section: BookSection,
  translations: TranslationMap,
  mode: Extract<ReadingMode, 'zh' | 'bilingual'>
): string {
  const secTrans = translations[section.id] ?? {};
  const partHtml = section.partTitleZh
    ? `<p class="part-kicker">${escapeXml(section.partTitleZh)}</p>`
    : '';

  let epigraphHtml = '';
  if (section.epigraphEn || section.epigraphZh) {
    const zhEp = section.epigraphZh ? `<p>${escapeXml(section.epigraphZh)}</p>` : '';
    const enEp =
      (mode === 'bilingual' || !section.epigraphZh) && section.epigraphEn
        ? `<p class="epigraph-en">${escapeXml(section.epigraphEn)}</p>`
        : '';
    const attrText = section.epigraphAttributionZh || section.epigraphAttributionEn;
    const attrHtml = attrText ? `<p class="epigraph-attr">${escapeXml(attrText)}</p>` : '';
    epigraphHtml = `<blockquote class="epigraph">${zhEp}${enEp}${attrHtml}</blockquote>`;
  }

  const bodyBlocks = section.paragraphs
    .map((p, idx) => renderParagraphXhtml(p, idx, section, secTrans, mode))
    .filter(Boolean)
    .join('\n  ');

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="zh-CN" lang="zh-CN">
<head>
  <meta charset="UTF-8"/>
  <title>${escapeXml(section.titleZh)}</title>
  <link rel="stylesheet" type="text/css" href="../styles/book.css"/>
</head>
<body>
  <header>
    ${partHtml}
    <h1 class="chapter-title">${escapeXml(section.titleZh)}</h1>
    <p class="chapter-subtitle">${escapeXml(section.titleEn)}</p>
    ${epigraphHtml}
  </header>
  ${bodyBlocks}
</body>
</html>
`;
}

function renderNavXhtml(book: BookData, includedSections: BookSection[]): string {
  const items = [
    `      <li><a href="cover.xhtml">封面 · 《${escapeXml(book.titleZh)}》</a></li>`,
    ...includedSections.map(
      (sec) =>
        `      <li><a href="sections/${escapeXml(sec.id)}.xhtml">${escapeXml(sec.titleZh)}</a></li>`
    ),
  ].join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="zh-CN" lang="zh-CN">
<head>
  <meta charset="UTF-8"/>
  <title>目录 — 《${escapeXml(book.titleZh)}》</title>
  <link rel="stylesheet" type="text/css" href="styles/book.css"/>
</head>
<body>
  <nav epub:type="toc" id="toc">
    <h1>目录</h1>
    <ol>
${items}
    </ol>
  </nav>
</body>
</html>
`;
}

function renderTocNcx(
  book: BookData,
  includedSections: BookSection[],
  bookUid: string
): string {
  const navPoints = [
    `    <navPoint id="navPoint-cover" playOrder="1">
      <navLabel><text>封面 · 《${escapeXml(book.titleZh)}》</text></navLabel>
      <content src="cover.xhtml"/>
    </navPoint>`,
    ...includedSections.map(
      (sec, idx) => `    <navPoint id="navPoint-${escapeXml(sec.id)}" playOrder="${idx + 2}">
      <navLabel><text>${escapeXml(sec.titleZh)}</text></navLabel>
      <content src="sections/${escapeXml(sec.id)}.xhtml"/>
    </navPoint>`
    ),
  ].join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
  <head>
    <meta name="dtb:uid" content="${escapeXml(bookUid)}"/>
    <meta name="dtb:depth" content="1"/>
    <meta name="dtb:totalPageCount" content="0"/>
    <meta name="dtb:maxPageNumber" content="0"/>
  </head>
  <docTitle><text>《${escapeXml(book.titleZh)}》</text></docTitle>
  <navMap>
${navPoints}
  </navMap>
</ncx>
`;
}

function renderContentOpf(
  book: BookData,
  includedSections: BookSection[],
  mode: Extract<ReadingMode, 'zh' | 'bilingual'>,
  bookUid: string,
  modifiedIso: string
): string {
  const titleWithEdition =
    mode === 'bilingual'
      ? `${book.titleZh}（中英双语对照版）`
      : book.titleZh;

  const sectionManifestItems = includedSections
    .map(
      (sec) =>
        `    <item id="${toOpfId(sec.id)}" href="sections/${escapeXml(sec.id)}.xhtml" media-type="application/xhtml+xml"/>`
    )
    .join('\n');

  const sectionSpineItems = includedSections
    .map((sec) => `    <itemref idref="${toOpfId(sec.id)}"/>`)
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="bookid" xml:lang="zh-CN">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="bookid">${escapeXml(bookUid)}</dc:identifier>
    <dc:title>${escapeXml(titleWithEdition)}</dc:title>
    <dc:creator>${escapeXml(book.author)} / ${escapeXml(book.coauthor)}</dc:creator>
    <dc:language>zh-CN</dc:language>
    <dc:description>${escapeXml(book.subtitleZh)}（${escapeXml(book.editionZh)}）</dc:description>
    <meta property="dcterms:modified">${escapeXml(modifiedIso)}</meta>
  </metadata>
  <manifest>
    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
    <item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>
    <item id="css" href="styles/book.css" media-type="text/css"/>
    <item id="cover-image" href="images/cover.svg" media-type="image/svg+xml" properties="cover-image"/>
    <item id="cover" href="cover.xhtml" media-type="application/xhtml+xml"/>
${sectionManifestItems}
  </manifest>
  <spine toc="ncx">
    <itemref idref="cover"/>
    <itemref idref="nav"/>
${sectionSpineItems}
  </spine>
</package>
`;
}

export function buildEpubPackageFiles(
  book: BookData,
  translations: TranslationMap,
  mode: Extract<ReadingMode, 'zh' | 'bilingual'>,
  includeOnlyTranslated = true,
  modifiedIso = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z')
): EpubPackage {
  const includedSections = getIncludedEpubSections(book, translations, includeOnlyTranslated);
  const bookUid = `urn:uuid:slight-edge-${mode}-8th-edition`;
  const filename = `微小的优势_The_Slight_Edge_${mode === 'bilingual' ? '双语版' : '中文版'}.epub`;

  const files: EpubFileEntry[] = [
    {
      path: 'mimetype',
      content: 'application/epub+zip',
      store: true,
    },
    {
      path: 'META-INF/container.xml',
      content: `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>
`,
    },
    {
      path: 'OEBPS/styles/book.css',
      content: renderBookCss(),
    },
    {
      path: 'OEBPS/images/cover.svg',
      content: renderCoverSvg(book, mode),
    },
    {
      path: 'OEBPS/cover.xhtml',
      content: renderCoverXhtml(book, mode),
    },
    {
      path: 'OEBPS/nav.xhtml',
      content: renderNavXhtml(book, includedSections),
    },
    {
      path: 'OEBPS/toc.ncx',
      content: renderTocNcx(book, includedSections, bookUid),
    },
    {
      path: 'OEBPS/content.opf',
      content: renderContentOpf(book, includedSections, mode, bookUid, modifiedIso),
    },
    ...includedSections.map((sec) => ({
      path: `OEBPS/sections/${sec.id}.xhtml`,
      content: renderSectionXhtml(sec, translations, mode),
    })),
  ];

  return { filename, files, includedSections };
}

function buildZipInstance(pkg: EpubPackage): JSZip {
  const zip = new JSZip();
  for (const entry of pkg.files) {
    zip.file(entry.path, entry.content, {
      compression: entry.store ? 'STORE' : 'DEFLATE',
    });
  }
  return zip;
}

export async function generateEpubBlob(
  book: BookData,
  translations: TranslationMap,
  mode: Extract<ReadingMode, 'zh' | 'bilingual'>,
  includeOnlyTranslated = true
): Promise<{ blob: Blob; filename: string; sectionCount: number }> {
  const pkg = buildEpubPackageFiles(book, translations, mode, includeOnlyTranslated);
  const zip = buildZipInstance(pkg);
  const blob = await zip.generateAsync({
    type: 'blob',
    mimeType: 'application/epub+zip',
  });
  return {
    blob,
    filename: pkg.filename,
    sectionCount: pkg.includedSections.length,
  };
}

export async function generateEpubUint8Array(
  book: BookData,
  translations: TranslationMap,
  mode: Extract<ReadingMode, 'zh' | 'bilingual'>,
  includeOnlyTranslated = true
): Promise<{ data: Uint8Array; filename: string; sectionCount: number }> {
  const pkg = buildEpubPackageFiles(book, translations, mode, includeOnlyTranslated);
  const zip = buildZipInstance(pkg);
  const data = await zip.generateAsync({
    type: 'uint8array',
  });
  return {
    data,
    filename: pkg.filename,
    sectionCount: pkg.includedSections.length,
  };
}
