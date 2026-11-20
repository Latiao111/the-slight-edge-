import type { HighlightEntry, MicroHabitItem, StudyCardEntry, TeacherMode } from '../types/book';

export const DEFAULT_MICRO_HABITS: MicroHabitItem[] = [
  {
    id: 'habit-read-10',
    title: '每天精读 10 页好书（或 1 节《微小的优势》）',
    area: '个人成长',
    completedDates: [],
    createdAt: 1700000000001,
  },
  {
    id: 'habit-gratitude',
    title: '清晨写下 3 件值得感恩的新事物（肖恩·阿克尔幸福习惯）',
    area: '幸福感',
    completedDates: [],
    createdAt: 1700000000002,
  },
  {
    id: 'habit-exercise',
    title: '每天 15 分钟轻度有氧运动或散步',
    area: '健康',
    completedDates: [],
    createdAt: 1700000000003,
  },
  {
    id: 'habit-reflect',
    title: '睡前 2 分钟记录今天一件开心小事并复盘微小行动',
    area: '反思之力',
    completedDates: [],
    createdAt: 1700000000004,
  },
];

export function formatLocalDateKey(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getRecentDateKeys(days = 7, now = new Date()): string[] {
  const keys: string[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const dt = new Date(now);
    dt.setDate(dt.getDate() - i);
    keys.push(formatLocalDateKey(dt));
  }
  return keys;
}

export function toggleHabitForDate(
  habits: MicroHabitItem[],
  habitId: string,
  dateKey: string
): MicroHabitItem[] {
  return habits.map((h) => {
    if (h.id !== habitId) return h;
    const exists = h.completedDates.includes(dateKey);
    const nextDates = exists
      ? h.completedDates.filter((d) => d !== dateKey)
      : [...h.completedDates, dateKey].sort();
    return { ...h, completedDates: nextDates };
  });
}

export function calculateHabitStreak(habit: MicroHabitItem, now = new Date()): number {
  const completedSet = new Set(habit.completedDates);
  const todayKey = formatLocalDateKey(now);
  const cursor = new Date(now);

  // If today is not yet checked, allow active streak up to yesterday
  if (!completedSet.has(todayKey)) {
    cursor.setDate(cursor.getDate() - 1);
  }

  let streak = 0;
  while (completedSet.has(formatLocalDateKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export function addHighlightEntry(
  list: HighlightEntry[],
  incoming: Omit<HighlightEntry, 'id' | 'createdAt'>
): HighlightEntry[] {
  const cleanedText = incoming.text.trim();
  if (!cleanedText) return list;

  // Deduplicate identical text in same section
  const existingIdx = list.findIndex(
    (item) => item.sectionId === incoming.sectionId && item.text === cleanedText
  );
  if (existingIdx >= 0) {
    const updated = [...list];
    updated[existingIdx] = {
      ...updated[existingIdx],
      note: incoming.note || updated[existingIdx].note,
    };
    return updated;
  }

  const next: HighlightEntry = {
    ...incoming,
    text: cleanedText,
    id: `hl-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    createdAt: Date.now(),
  };
  return [next, ...list];
}

export function addStudyCardEntry(
  list: StudyCardEntry[],
  incoming: {
    mode: TeacherMode;
    prompt: string;
    content: string;
    sectionTitleZh?: string;
  }
): StudyCardEntry[] {
  const prompt = incoming.prompt.trim();
  const content = incoming.content.trim();
  if (!prompt || !content) return list;

  const existingIdx = list.findIndex(
    (item) => item.mode === incoming.mode && item.prompt.toLowerCase() === prompt.toLowerCase()
  );
  if (existingIdx >= 0) {
    const updated = [...list];
    updated[existingIdx] = {
      ...updated[existingIdx],
      content,
      sectionTitleZh: incoming.sectionTitleZh || updated[existingIdx].sectionTitleZh,
    };
    return updated;
  }

  const next: StudyCardEntry = {
    id: `card-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    mode: incoming.mode,
    prompt,
    content,
    sectionTitleZh: incoming.sectionTitleZh,
    mastered: false,
    createdAt: Date.now(),
  };
  return [next, ...list];
}

export function buildStudyNotesMarkdown(params: {
  highlights: HighlightEntry[];
  cards: StudyCardEntry[];
  habits: MicroHabitItem[];
  exportedAt?: Date;
}): string {
  const now = params.exportedAt ?? new Date();
  const lines: string[] = [];

  lines.push('---');
  lines.push('title: "《微小的优势》个人读书笔记与研学档案"');
  lines.push('book: "The Slight Edge / 微小的优势"');
  lines.push(`exported_at: "${now.toISOString()}"`);
  lines.push(`study_cards_count: ${params.cards.length}`);
  lines.push(`highlights_count: ${params.highlights.length}`);
  lines.push(`habits_count: ${params.habits.length}`);
  lines.push('tags:');
  lines.push('  - slight-edge');
  lines.push('  - reading-notes');
  lines.push('  - english-study');
  lines.push('---');
  lines.push('');
  lines.push('# 《微小的优势》个人读书笔记与研学档案');
  lines.push('');

  lines.push(`## 一、划线摘录与批注（共 ${params.highlights.length} 条）`);
  lines.push('');
  if (params.highlights.length === 0) {
    lines.push('暂无摘录。');
  } else {
    for (const h of params.highlights) {
      lines.push(`- **${h.sectionTitleZh}**`);
      lines.push(`  > ${h.text.replace(/\r?\n/g, '\n  > ')}`);
      if (h.note.trim()) {
        lines.push(`  - 个人批注：${h.note.trim()}`);
      }
      lines.push('');
    }
  }

  lines.push(`## 二、生词、精读与延伸知识卡片（共 ${params.cards.length} 张）`);
  lines.push('');
  if (params.cards.length === 0) {
    lines.push('暂无知识卡片。');
  } else {
    for (const c of params.cards) {
      const modeLabel =
        c.mode === 'vocab' ? '单词短语' : c.mode === 'article' ? '句子文章' : '延伸研学';
      const firstLine = c.prompt.split(/\r?\n/)[0]?.trim() || c.prompt;
      lines.push(
        `### [${modeLabel}] ${firstLine} ${c.mastered ? '（已掌握）' : '（待复习）'}`
      );
      if (c.sectionTitleZh) {
        lines.push(`- **关联章节**：${c.sectionTitleZh}`);
      }
      lines.push(`- **记录时间**：${new Date(c.createdAt).toISOString()}`);
      lines.push('');
      if (c.prompt.includes('\n')) {
        lines.push('**原文 / 语境：**');
        lines.push('');
        for (const pLine of c.prompt.replace(/\r\n/g, '\n').split('\n')) {
          lines.push(pLine.trim() ? `> ${pLine}` : '>');
        }
        lines.push('');
      }
      lines.push(c.content.replace(/\r\n/g, '\n').trim());
      lines.push('');
      lines.push('---');
      lines.push('');
    }
  }

  lines.push(`## 三、我的每日微小自律清单（共 ${params.habits.length} 项）`);
  lines.push('');
  for (const habit of params.habits) {
    lines.push(
      `- [${habit.area}] ${habit.title}（累计完成 ${habit.completedDates.length} 天）`
    );
  }
  lines.push('');

  return lines.join('\n');
}
