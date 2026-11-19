import assert from 'node:assert/strict';
import test from 'node:test';
import {
  addHighlightEntry,
  addStudyCardEntry,
  buildStudyNotesMarkdown,
  calculateHabitStreak,
  DEFAULT_MICRO_HABITS,
  toggleHabitForDate,
} from './studyStorage';

test('toggleHabitForDate and calculateHabitStreak compute consecutive streaks accurately', () => {
  const now = new Date('2026-11-18T12:00:00');
  let habits = DEFAULT_MICRO_HABITS;
  habits = toggleHabitForDate(habits, 'habit-read-10', '2026-11-16');
  habits = toggleHabitForDate(habits, 'habit-read-10', '2026-11-17');
  habits = toggleHabitForDate(habits, 'habit-read-10', '2026-11-18');

  const readHabit = habits.find((h) => h.id === 'habit-read-10')!;
  assert.equal(calculateHabitStreak(readHabit, now), 3);

  // Toggling today off keeps yesterday's active streak of 2
  habits = toggleHabitForDate(habits, 'habit-read-10', '2026-11-18');
  const updatedHabit = habits.find((h) => h.id === 'habit-read-10')!;
  assert.equal(calculateHabitStreak(updatedHabit, now), 2);
});

test('addHighlightEntry deduplicates identical excerpts in same section and exports clean Markdown', () => {
  let highlights = addHighlightEntry([], {
    sectionId: 'ch-1',
    sectionTitleZh: '第 1 章 · 沙滩流浪汉与百万富翁',
    text: 'Easy to do, easy not to do.',
    note: '全书最核心的一句话',
  });
  highlights = addHighlightEntry(highlights, {
    sectionId: 'ch-1',
    sectionTitleZh: '第 1 章 · 沙滩流浪汉与百万富翁',
    text: 'Easy to do, easy not to do.',
    note: '更新后的批注',
  });
  assert.equal(highlights.length, 1);
  assert.equal(highlights[0].note, '更新后的批注');

  const cards = addStudyCardEntry([], {
    mode: 'explore',
    prompt: '潜能蓄力平台',
    content: '### 1. 核心原理\n冰块在 0°C 前看似静止，实则在蓄能。',
    sectionTitleZh: '第 6 章',
  });
  assert.equal(cards.length, 1);

  const md = buildStudyNotesMarkdown({
    highlights,
    cards,
    habits: DEFAULT_MICRO_HABITS,
  });
  assert.match(md, /# 《微小的优势》个人读书笔记与研学档案/);
  assert.match(md, /更新后的批注/);
  assert.match(md, /\[延伸研学\] 潜能蓄力平台/);
});
