import {
  ArrowRight,
  Bookmark,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Download,
  Flame,
  GraduationCap,
  Plus,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import type {
  HighlightEntry,
  MicroHabitItem,
  StudyCardEntry,
  TeacherMode,
} from '../types/book';
import {
  buildStudyNotesMarkdown,
  calculateHabitStreak,
  formatLocalDateKey,
  getRecentDateKeys,
} from '../utils/studyStorage';
import { buildStudyNoteFilename, buildStudyNoteMarkdownDocument } from '../utils/teacherBot';

type NotebookTab = 'highlights' | 'cards' | 'habits';

interface StudyNotebookViewProps {
  highlights: HighlightEntry[];
  studyCards: StudyCardEntry[];
  habits: MicroHabitItem[];
  onJumpToSection: (sectionId: string, paragraphId?: string) => void;
  onLearnText: (text: string, mode?: TeacherMode) => void;
  onUpdateHighlightNote: (id: string, note: string) => void;
  onDeleteHighlight: (id: string) => void;
  onToggleCardMastered: (id: string) => void;
  onDeleteCard: (id: string) => void;
  onToggleHabitDate: (habitId: string, dateKey: string) => void;
  onAddHabit: (title: string, area: string) => void;
  onDeleteHabit: (habitId: string) => void;
}

const HABIT_AREAS = ['个人成长', '健康', '幸福感', '财务', '人际关系', '反思之力'];

export function StudyNotebookView({
  highlights,
  studyCards,
  habits,
  onJumpToSection,
  onLearnText,
  onUpdateHighlightNote,
  onDeleteHighlight,
  onToggleCardMastered,
  onDeleteCard,
  onToggleHabitDate,
  onAddHabit,
  onDeleteHabit,
}: StudyNotebookViewProps) {
  const [activeTab, setActiveTab] = useState<NotebookTab>('cards');
  const [cardModeFilter, setCardModeFilter] = useState<'all' | TeacherMode>('all');
  const [cardMasteryFilter, setCardMasteryFilter] = useState<'all' | 'review' | 'mastered'>('all');
  const [expandedCardIds, setExpandedCardIds] = useState<Record<string, boolean>>({});

  // New habit form
  const [newHabitTitle, setNewHabitTitle] = useState('');
  const [newHabitArea, setNewHabitArea] = useState(HABIT_AREAS[0]);

  const todayKey = useMemo(() => formatLocalDateKey(new Date()), []);
  const recent7Days = useMemo(() => getRecentDateKeys(7, new Date()), []);

  const filteredCards = useMemo(() => {
    return studyCards.filter((card) => {
      if (cardModeFilter !== 'all' && card.mode !== cardModeFilter) return false;
      if (cardMasteryFilter === 'review' && card.mastered) return false;
      if (cardMasteryFilter === 'mastered' && !card.mastered) return false;
      return true;
    });
  }, [studyCards, cardModeFilter, cardMasteryFilter]);

  const todayDoneCount = useMemo(
    () => habits.filter((h) => h.completedDates.includes(todayKey)).length,
    [habits, todayKey]
  );

  const masteredCount = useMemo(
    () => studyCards.filter((c) => c.mastered).length,
    [studyCards]
  );

  const handleExportMarkdown = () => {
    const md = buildStudyNotesMarkdown({
      highlights,
      cards: studyCards,
      habits,
    });
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `微小的优势_个人读书笔记_${todayKey}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleExportSingleCardMarkdown = (card: StudyCardEntry) => {
    const dt = new Date(card.createdAt);
    const filename = buildStudyNoteFilename(card.mode, card.prompt, dt);
    const md = buildStudyNoteMarkdownDocument({
      mode: card.mode,
      userPrompt: card.prompt,
      markdownContent: card.content,
      sectionTitleZh: card.sectionTitleZh,
      date: dt,
    });
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleCreateHabit = () => {
    const cleaned = newHabitTitle.trim();
    if (!cleaned) return;
    onAddHabit(cleaned, newHabitArea);
    setNewHabitTitle('');
  };

  const modeLabel = (mode: TeacherMode): string => {
    if (mode === 'vocab') return '单词短语';
    if (mode === 'article') return '句子文章';
    return '延伸研学';
  };

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-8 sm:py-14">
      <header className="border-b border-stone-200 pb-8 dark:border-zinc-800">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs tracking-[0.2em] text-stone-500 uppercase dark:text-zinc-400">
              Personal Study Archive &amp; Daily Discipline
            </p>
            <h1 className="font-editorial mt-2 text-3xl font-semibold text-stone-950 sm:text-4xl text-balance dark:text-stone-100">
              个人学习笔记与践行打卡
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-stone-600 dark:text-zinc-400">
              每一次向「英语老师」请教的生词、长难句与延伸科普都会自动保留为结构化卡片；导出为含 YAML 元数据的无损 <code className="font-num text-xs">.md</code> 文件后，可直接交给其他 AI Skill 或笔记库进行跨章节总结。
            </p>
          </div>

          <button
            type="button"
            onClick={handleExportMarkdown}
            data-testid="export-all-notes-md-btn"
            className="inline-flex h-9 items-center gap-1.5 self-start rounded-md border border-stone-300 px-3.5 text-xs font-medium text-stone-800 transition-colors hover:border-[#78350F] hover:text-[#78350F] dark:border-zinc-700 dark:text-stone-200 dark:hover:border-amber-400 dark:hover:text-amber-400 whitespace-nowrap shrink-0 cursor-pointer sm:self-end"
          >
            <Download className="h-3.5 w-3.5" />
            <span>导出全部 .md</span>
          </button>
        </div>

        {/* Unboxed Summary Strip */}
        <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-b border-stone-200 py-3 text-xs text-stone-600 dark:border-zinc-800 dark:text-zinc-400">
          <span>
            知识卡片 <strong className="font-num text-stone-900 dark:text-stone-100">{studyCards.length}</strong> 张（已掌握{' '}
            <strong className="font-num text-[#14532D] dark:text-emerald-400">{masteredCount}</strong> 张）
          </span>
          <span aria-hidden="true">·</span>
          <span>
            划线摘录 <strong className="font-num text-stone-900 dark:text-stone-100">{highlights.length}</strong> 条
          </span>
          <span aria-hidden="true">·</span>
          <span>
            今日微自律{' '}
            <strong className="font-num text-[#78350F] dark:text-amber-400">
              {todayDoneCount}/{habits.length}
            </strong>{' '}
            项已完成
          </span>
        </div>

        {/* Notebook Tabs */}
        <div
          role="tablist"
          aria-label="学习笔记模块"
          className="mt-6 flex flex-wrap items-center gap-1.5 rounded-lg bg-[#EBE6DF] p-1 w-fit dark:bg-zinc-900"
        >
          {(
            [
              { id: 'cards', label: `知识卡片 (${studyCards.length})`, icon: GraduationCap },
              { id: 'highlights', label: `划线摘录 (${highlights.length})`, icon: Bookmark },
              { id: 'habits', label: `每日微小自律 (${todayDoneCount}/${habits.length})`, icon: Flame },
            ] as const
          ).map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                data-testid={`notebook-tab-${tab.id}`}
                onClick={() => setActiveTab(tab.id)}
                className={`inline-flex items-center gap-1.5 rounded-md px-3.5 py-2 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  active
                    ? 'bg-[#FBF9F5] text-[#78350F] shadow-xs font-semibold dark:bg-zinc-800 dark:text-amber-400'
                    : 'text-stone-600 hover:text-stone-950 dark:text-zinc-400 dark:hover:text-stone-100'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </header>

      {/* TAB 1: Saved AI Study Cards */}
      {activeTab === 'cards' && (
        <section className="mt-8 space-y-6" aria-label="知识卡片库">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <div
                role="group"
                aria-label="卡片类型筛选"
                className="inline-flex rounded-md bg-[#EBE6DF] p-0.5 dark:bg-zinc-900"
              >
                {(
                  [
                    { id: 'all', label: '全部类型' },
                    { id: 'vocab', label: '单词短语' },
                    { id: 'article', label: '句子文章' },
                    { id: 'explore', label: '延伸研学' },
                  ] as const
                ).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setCardModeFilter(item.id)}
                    className={`rounded-[5px] px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                      cardModeFilter === item.id
                        ? 'bg-[#FBF9F5] text-stone-950 shadow-xs dark:bg-zinc-800 dark:text-amber-400'
                        : 'text-stone-600 hover:text-stone-950 dark:text-zinc-400 dark:hover:text-stone-100'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              <div
                role="group"
                aria-label="掌握状态筛选"
                className="inline-flex rounded-md bg-[#EBE6DF] p-0.5 dark:bg-zinc-900"
              >
                {(
                  [
                    { id: 'all', label: '全部状态' },
                    { id: 'review', label: '待复习' },
                    { id: 'mastered', label: '已掌握' },
                  ] as const
                ).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setCardMasteryFilter(item.id)}
                    className={`rounded-[5px] px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                      cardMasteryFilter === item.id
                        ? 'bg-[#FBF9F5] text-stone-950 shadow-xs dark:bg-zinc-800 dark:text-amber-400'
                        : 'text-stone-600 hover:text-stone-950 dark:text-zinc-400 dark:hover:text-stone-100'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {filteredCards.length === 0 ? (
            <div className="border border-stone-200 bg-[#F3EFE6]/50 px-6 py-12 text-center dark:border-zinc-800 dark:bg-[#111317]">
              <p className="font-editorial text-lg text-stone-800 dark:text-stone-200">
                还没有存入知识卡片
              </p>
              <p className="mt-2 text-xs text-stone-500 dark:text-zinc-400">
                在英文精读时双击任意生词、点击段落「精讲此段」或在右侧「英语老师」面板提问，每次讲解都会自动保存为无损 Markdown 卡片并沉淀在此。
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredCards.map((card) => {
                const isExpanded = expandedCardIds[card.id] ?? true;
                return (
                  <article
                    key={card.id}
                    data-testid="study-card-item"
                    className="border border-stone-200 bg-[#FBF9F5] p-5 dark:border-zinc-800 dark:bg-[#111317]"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-x-2 text-xs text-stone-500 dark:text-zinc-400">
                          <span className="font-medium text-[#78350F] dark:text-amber-400">
                            {modeLabel(card.mode)}
                          </span>
                          {card.sectionTitleZh && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span>{card.sectionTitleZh}</span>
                            </>
                          )}
                          <span aria-hidden="true">·</span>
                          <span
                            className={
                              card.mastered
                                ? 'text-[#14532D] font-medium dark:text-emerald-400'
                                : 'text-stone-500 dark:text-zinc-400'
                            }
                          >
                            {card.mastered ? '已掌握' : '待复习'}
                          </span>
                        </div>
                        <h3 className="font-editorial mt-1.5 text-base font-semibold text-stone-950 dark:text-stone-100">
                          {card.prompt}
                        </h3>
                      </div>

                      <div className="flex shrink-0 items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleExportSingleCardMarkdown(card)}
                          title="导出此条笔记为独立无损 .md 文件"
                          data-testid="card-export-md-btn"
                          className="inline-flex items-center gap-1 rounded-md border border-stone-300 px-2.5 py-1 text-xs font-medium text-stone-600 transition-colors hover:border-[#78350F] hover:text-[#78350F] dark:border-zinc-700 dark:text-zinc-300 dark:hover:border-amber-400 dark:hover:text-amber-400 cursor-pointer"
                        >
                          <Download className="h-3.5 w-3.5" />
                          <span>导出 .md</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => onToggleCardMastered(card.id)}
                          className={`inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer ${
                            card.mastered
                              ? 'border-[#14532D]/40 bg-[#14532D]/10 text-[#14532D] dark:border-emerald-500/40 dark:bg-emerald-950/30 dark:text-emerald-400'
                              : 'border-stone-300 text-stone-600 hover:border-[#14532D] hover:text-[#14532D] dark:border-zinc-700 dark:text-zinc-300 dark:hover:border-emerald-400 dark:hover:text-emerald-400'
                          }`}
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          <span>{card.mastered ? '标为待复习' : '标为已掌握'}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            setExpandedCardIds((prev) => ({ ...prev, [card.id]: !isExpanded }))
                          }
                          aria-label={isExpanded ? '收起笔记内容' : '展开笔记内容'}
                          className="inline-flex h-7 w-7 items-center justify-center rounded border border-stone-200 text-stone-500 hover:text-stone-900 dark:border-zinc-800 dark:text-zinc-400 dark:hover:text-stone-100 cursor-pointer"
                        >
                          {isExpanded ? (
                            <ChevronUp className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={() => onDeleteCard(card.id)}
                          aria-label="删除卡片"
                          className="inline-flex h-7 w-7 items-center justify-center rounded text-stone-400 hover:text-[#9A3412] dark:text-zinc-500 dark:hover:text-orange-400 cursor-pointer"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="mt-4 border-t border-stone-200/70 pt-4 text-sm leading-relaxed whitespace-pre-wrap text-stone-700 dark:border-zinc-800/80 dark:text-stone-300">
                        {card.content}
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* TAB 2: Highlights & Annotations */}
      {activeTab === 'highlights' && (
        <section className="mt-8" aria-label="划线摘录与批注">
          {highlights.length === 0 ? (
            <div className="border border-stone-200 bg-[#F3EFE6]/50 px-6 py-12 text-center dark:border-zinc-800 dark:bg-[#111317]">
              <p className="font-editorial text-lg text-stone-800 dark:text-stone-200">
                暂无划线摘录
              </p>
              <p className="mt-2 text-xs text-stone-500 dark:text-zinc-400">
                在「正文精读」中划选任意中英文句子点击「摘录收藏」，或悬停段落点击「收藏此段」，即可沉淀在此并随时写下个人批注。
              </p>
            </div>
          ) : (
            <div className="divide-y divide-stone-200 dark:divide-zinc-800">
              {highlights.map((hl) => (
                <article key={hl.id} data-testid="highlight-item" className="py-6">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-stone-500 dark:text-zinc-400">
                    <span className="font-medium text-[#78350F] dark:text-amber-400">
                      {hl.sectionTitleZh}
                    </span>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() =>
                          onLearnText(
                            `请帮我深度解析下面这段书摘的核心思想，并联系相关学科理论给出延伸启发：\n\n${hl.text}`,
                            'explore'
                          )
                        }
                        className="inline-flex items-center gap-1 text-stone-600 hover:text-[#78350F] dark:text-zinc-400 dark:hover:text-amber-400 cursor-pointer"
                      >
                        <Sparkles className="h-3.5 w-3.5" />
                        <span>请老师延伸解读</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onJumpToSection(hl.sectionId, hl.paragraphId)}
                        className="inline-flex items-center gap-1 text-[#78350F] hover:underline dark:text-amber-400 cursor-pointer"
                      >
                        <span>回到原文</span>
                        <ArrowRight className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteHighlight(hl.id)}
                        aria-label="删除摘录"
                        className="text-stone-400 hover:text-[#9A3412] dark:text-zinc-500 dark:hover:text-orange-400 cursor-pointer"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  <blockquote className="font-editorial mt-3 whitespace-pre-wrap text-base leading-relaxed text-stone-900 dark:text-stone-100">
                    “{hl.text}”
                  </blockquote>

                  <div className="mt-3">
                    <label htmlFor={`note-${hl.id}`} className="sr-only">
                      个人读书批注
                    </label>
                    <textarea
                      id={`note-${hl.id}`}
                      rows={2}
                      value={hl.note}
                      onChange={(e) => onUpdateHighlightNote(hl.id, e.target.value)}
                      placeholder="写下你的个人思考、生活联结或行动计划（自动保存）…"
                      className="w-full rounded-md border border-stone-200 bg-[#F3EFE6]/40 px-3 py-2 text-xs leading-relaxed text-stone-800 placeholder:text-stone-400 focus:border-[#78350F] focus:outline-none dark:border-zinc-800 dark:bg-[#14161A] dark:text-stone-200 dark:placeholder:text-zinc-500 dark:focus:border-amber-500"
                    />
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      )}

      {/* TAB 3: Daily Micro-Habits Tracker */}
      {activeTab === 'habits' && (
        <section className="mt-8 space-y-8" aria-label="每日微小自律打卡">
          {/* Add Custom Habit Form */}
          <div className="border border-stone-200 bg-[#F3EFE6]/50 p-5 dark:border-zinc-800 dark:bg-[#14161A]">
            <p className="text-xs font-semibold tracking-wider text-[#78350F] uppercase dark:text-amber-400">
              新增一条“做起来容易，不做也容易”的微小日常自律
            </p>
            <div className="mt-3 flex flex-col gap-3 sm:flex-row">
              <select
                value={newHabitArea}
                onChange={(e) => setNewHabitArea(e.target.value)}
                aria-label="生活领域"
                className="rounded-md border border-stone-300 bg-[#FBF9F5] px-3 py-2 text-xs text-stone-800 focus:border-[#78350F] focus:outline-none dark:border-zinc-700 dark:bg-[#0B0C0E] dark:text-stone-200"
              >
                {HABIT_AREAS.map((area) => (
                  <option key={area} value={area}>
                    {area}
                  </option>
                ))}
              </select>

              <input
                type="text"
                value={newHabitTitle}
                onChange={(e) => setNewHabitTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreateHabit();
                }}
                placeholder="例如：每天精读 1 段英文原著并记下 3 个地道表达"
                className="flex-1 rounded-md border border-stone-300 bg-[#FBF9F5] px-3 py-2 text-xs text-stone-900 placeholder:text-stone-400 focus:border-[#78350F] focus:outline-none dark:border-zinc-700 dark:bg-[#0B0C0E] dark:text-stone-100 dark:placeholder:text-zinc-500"
              />

              <button
                type="button"
                onClick={handleCreateHabit}
                className="inline-flex items-center justify-center gap-1.5 rounded-md bg-[#78350F] px-4 py-2 text-xs font-medium text-[#FBF9F5] hover:bg-[#5C280B] dark:bg-amber-600 dark:text-stone-950 dark:font-semibold dark:hover:bg-amber-500 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>加入自律清单</span>
              </button>
            </div>
          </div>

          {/* Habits 7-Day Matrix */}
          <div className="divide-y divide-stone-200 border border-stone-200 dark:divide-zinc-800 dark:border-zinc-800">
            {habits.map((habit) => {
              const streak = calculateHabitStreak(habit);
              const doneToday = habit.completedDates.includes(todayKey);
              return (
                <div
                  key={habit.id}
                  data-testid={`habit-row-${habit.id}`}
                  className="flex flex-col justify-between gap-4 bg-[#FBF9F5] p-5 sm:flex-row sm:items-center dark:bg-[#111317]"
                >
                  <div className="flex min-w-0 flex-1 items-start gap-3.5">
                    <button
                      type="button"
                      onClick={() => onToggleHabitDate(habit.id, todayKey)}
                      aria-pressed={doneToday}
                      aria-label={`打卡：${habit.title}`}
                      data-testid={`habit-toggle-${habit.id}`}
                      className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border transition-colors cursor-pointer ${
                        doneToday
                          ? 'border-[#14532D] bg-[#14532D] text-white dark:border-emerald-500 dark:bg-emerald-500 dark:text-stone-950'
                          : 'border-stone-300 bg-transparent text-transparent hover:border-[#78350F] dark:border-zinc-700 dark:hover:border-amber-400'
                      }`}
                    >
                      <Check className="h-3.5 w-3.5" />
                    </button>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2 text-[11px] text-stone-500 dark:text-zinc-400">
                        <span className="font-medium text-[#78350F] dark:text-amber-400">
                          {habit.area}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="font-num">
                          连续 {streak} 天 · 累计 {habit.completedDates.length} 天
                        </span>
                      </div>
                      <p
                        className={`mt-1 text-sm font-medium ${
                          doneToday
                            ? 'text-stone-500 line-through dark:text-zinc-400'
                            : 'text-stone-900 dark:text-stone-100'
                        }`}
                      >
                        {habit.title}
                      </p>
                    </div>
                  </div>

                  {/* Recent 7-day grid + delete */}
                  <div className="flex shrink-0 items-center gap-3">
                    <div className="flex items-center gap-1.5" aria-label="近 7 日打卡记录">
                      {recent7Days.map((dateKey) => {
                        const checked = habit.completedDates.includes(dateKey);
                        const dayLabel = dateKey.slice(8);
                        return (
                          <button
                            key={dateKey}
                            type="button"
                            title={`${dateKey}${checked ? '（已完成）' : '（未打卡）'}`}
                            onClick={() => onToggleHabitDate(habit.id, dateKey)}
                            className={`font-num flex h-7 w-7 items-center justify-center rounded text-[11px] transition-colors cursor-pointer ${
                              checked
                                ? 'bg-[#14532D] text-[#FBF9F5] font-semibold dark:bg-emerald-500 dark:text-stone-950'
                                : dateKey === todayKey
                                ? 'border border-[#78350F]/60 text-[#78350F] dark:border-amber-400/60 dark:text-amber-400'
                                : 'bg-stone-200/60 text-stone-500 hover:bg-stone-300/60 dark:bg-zinc-900 dark:text-zinc-500 dark:hover:bg-zinc-800'
                            }`}
                          >
                            {dayLabel}
                          </button>
                        );
                      })}
                    </div>

                    <button
                      type="button"
                      onClick={() => onDeleteHabit(habit.id)}
                      aria-label="删除此项微自律"
                      className="text-stone-400 hover:text-[#9A3412] dark:text-zinc-500 dark:hover:text-orange-400 cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </main>
  );
}
