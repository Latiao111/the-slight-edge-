import {
  ArrowRight,
  Bookmark,
  BookOpen,
  Compass,
  Sliders,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { RELATED_KNOWLEDGE_ITEMS } from '../data/relatedKnowledge';
import type { KnowledgeDiscipline, MaximItem, TeacherMode } from '../types/book';
import {
  computeCompoundingCurve,
  computePennyDoubledSeries,
  formatMultiplier,
} from '../utils/compoundingMath';

type HubTab = 'atlas' | 'simulator' | 'maxims';

interface KnowledgeHubViewProps {
  maxims: MaximItem[];
  onJumpToSection: (sectionId: string) => void;
  onLearnText: (text: string, mode?: TeacherMode) => void;
  onSaveHighlight: (params: {
    sectionId: string;
    sectionTitleZh: string;
    text: string;
    note?: string;
  }) => void;
}

const DISCIPLINES: { id: 'all' | KnowledgeDiscipline; label: string }[] = [
  { id: 'all', label: '全部领域' },
  { id: 'compounding', label: '数学与复利模型' },
  { id: 'habits', label: '行为与习惯科学' },
  { id: 'psychology', label: '积极心理学' },
  { id: 'books', label: '思想家与延伸书单' },
];

const MAXIM_THEMES: { id: 'all' | MaximItem['theme']; label: string }[] = [
  { id: 'all', label: '全部箴言' },
  { id: 'philosophy', label: '哲学与态度' },
  { id: 'time', label: '时间与复利' },
  { id: 'habits', label: '习惯与自律' },
  { id: 'happiness', label: '幸福与涟漪' },
];

const PENNY_MILESTONE_DAYS = [1, 5, 10, 15, 20, 25, 28, 30, 31];

export function KnowledgeHubView({
  maxims,
  onJumpToSection,
  onLearnText,
  onSaveHighlight,
}: KnowledgeHubViewProps) {
  const [activeTab, setActiveTab] = useState<HubTab>('atlas');
  const [disciplineFilter, setDisciplineFilter] = useState<'all' | KnowledgeDiscipline>('all');
  const [customTopic, setCustomTopic] = useState('');

  // Compounding Simulator state
  const [dailyRatePercent, setDailyRatePercent] = useState(1.0);
  const [days, setDays] = useState(365);
  const [dailyPages, setDailyPages] = useState(10);

  // Maxims filter
  const [maximFilter, setMaximFilter] = useState<'all' | MaximItem['theme']>('all');

  const filteredKnowledge = useMemo(
    () =>
      disciplineFilter === 'all'
        ? RELATED_KNOWLEDGE_ITEMS
        : RELATED_KNOWLEDGE_ITEMS.filter((item) => item.discipline === disciplineFilter),
    [disciplineFilter]
  );

  const filteredMaxims = useMemo(
    () => (maximFilter === 'all' ? maxims : maxims.filter((m) => m.theme === maximFilter)),
    [maxims, maximFilter]
  );

  const sim = useMemo(
    () =>
      computeCompoundingCurve({
        dailyRatePercent,
        days,
        dailyEffortUnits: dailyPages,
        sampleCount: 44,
      }),
    [dailyRatePercent, days, dailyPages]
  );

  const pennySeries = useMemo(() => computePennyDoubledSeries(31), []);

  // Build crisp SVG curve coordinates
  const chartGeometry = useMemo(() => {
    const width = 640;
    const height = 270;
    const padLeft = 52;
    const padRight = 24;
    const padTop = 22;
    const padBottom = 38;
    const plotW = width - padLeft - padRight;
    const plotH = height - padTop - padBottom;

    const maxY = Math.max(2.5, sim.positiveMultiplier * 1.06);
    const toX = (day: number) => padLeft + (day / sim.days) * plotW;
    const toY = (val: number) => padTop + plotH - (Math.min(val, maxY) / maxY) * plotH;

    const posPath = sim.series
      .map((pt, idx) => `${idx === 0 ? 'M' : 'L'} ${toX(pt.day).toFixed(1)} ${toY(pt.positive).toFixed(1)}`)
      .join(' ');
    const negPath = sim.series
      .map((pt, idx) => `${idx === 0 ? 'M' : 'L'} ${toX(pt.day).toFixed(1)} ${toY(pt.negative).toFixed(1)}`)
      .join(' ');
    const baselineY = toY(1);
    const tippingX = toX(sim.tippingPointDay);
    const tippingY = toY(Math.pow(1 + sim.dailyRatePercent / 100, sim.tippingPointDay));

    const posArea = `${posPath} L ${toX(sim.days).toFixed(1)} ${baselineY.toFixed(1)} L ${toX(0).toFixed(1)} ${baselineY.toFixed(1)} Z`;

    return {
      width,
      height,
      padLeft,
      padRight,
      padTop,
      padBottom,
      plotW,
      plotH,
      maxY,
      toX,
      toY,
      posPath,
      negPath,
      posArea,
      baselineY,
      tippingX,
      tippingY,
    };
  }, [sim]);

  const handleAskCustomTopic = () => {
    const trimmed = customTopic.trim();
    if (!trimmed) return;
    onLearnText(
      `请结合《微小的优势》的核心思想，深入延伸讲解「${trimmed}」：它与本书哪一章的原理相连、背后的科学或思想脉络是什么、以及我今天可以怎么实践。`,
      'explore'
    );
    setCustomTopic('');
  };

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-8 sm:py-14">
      {/* Page Header */}
      <header className="border-b border-stone-200 pb-8 dark:border-zinc-800">
        <p className="text-xs tracking-[0.2em] text-stone-500 uppercase dark:text-zinc-400">
          Interdisciplinary Study Studio
        </p>
        <h1 className="font-editorial mt-2 text-3xl font-semibold text-stone-950 sm:text-4xl text-balance dark:text-stone-100">
          延伸研学与复利实验室
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-stone-600 dark:text-zinc-400">
          读懂一本书，不仅要读透字里行间，更要把它的思想放进更广阔的知识网络里。这里将《微小的优势》与行为神经科学、积极心理学、指数复利数学及关联经典打通，支持随时推演曲线或请右侧导师展开跨学科精讲。
        </p>

        {/* Primary View Tabs */}
        <div
          role="tablist"
          aria-label="延伸研学模块"
          className="mt-6 flex flex-wrap items-center gap-1.5 rounded-lg bg-[#EBE6DF] p-1 w-fit dark:bg-zinc-900"
        >
          {(
            [
              { id: 'atlas', label: '跨学科知识图谱', icon: Compass },
              { id: 'simulator', label: '复利沙盘实验室', icon: TrendingUp },
              { id: 'maxims', label: '核心哲学箴言录', icon: BookOpen },
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
                data-testid={`knowledge-tab-${tab.id}`}
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

      {/* TAB 1: Interdisciplinary Knowledge Atlas */}
      {activeTab === 'atlas' && (
        <section className="mt-8 space-y-8" aria-label="跨学科知识图谱">
          {/* Free-form Related Concept Ask Bar */}
          <div className="border border-stone-200 bg-[#F3EFE6]/60 p-5 dark:border-zinc-800 dark:bg-[#14161A]">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="flex-1">
                <label
                  htmlFor="custom-explore-input"
                  className="text-xs font-semibold tracking-wider text-[#78350F] uppercase dark:text-amber-400"
                >
                  自由延伸提问 · 串联书外知识
                </label>
                <input
                  id="custom-explore-input"
                  type="text"
                  value={customTopic}
                  onChange={(e) => setCustomTopic(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleAskCustomTopic();
                  }}
                  placeholder="输入你想延伸学习的理论、人物或关联书目（如：微小的优势与原子习惯的区别、多巴胺奖励回路、查理·芒格复利思维）…"
                  className="mt-2 w-full rounded-md border border-stone-300/90 bg-[#FBF9F5] px-3.5 py-2.5 text-sm text-stone-900 placeholder:text-stone-400 focus:border-[#78350F] focus:outline-none dark:border-zinc-700 dark:bg-[#0B0C0E] dark:text-stone-100 dark:placeholder:text-zinc-500 dark:focus:border-amber-500"
                />
              </div>
              <button
                type="button"
                onClick={handleAskCustomTopic}
                className="inline-flex h-10 items-center justify-center gap-1.5 self-end rounded-md bg-[#78350F] px-5 text-xs font-medium text-[#FBF9F5] transition-colors hover:bg-[#5C280B] dark:bg-amber-600 dark:text-stone-950 dark:font-semibold dark:hover:bg-amber-500 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span>请导师延伸精讲</span>
              </button>
            </div>
          </div>

          {/* Discipline Filter Row */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div
              role="group"
              aria-label="学科领域筛选"
              className="flex flex-wrap items-center gap-1.5 rounded-md bg-[#EBE6DF] p-0.5 dark:bg-zinc-900"
            >
              {DISCIPLINES.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => setDisciplineFilter(d.id)}
                  className={`rounded-[5px] px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    disciplineFilter === d.id
                      ? 'bg-[#FBF9F5] text-stone-950 shadow-xs dark:bg-zinc-800 dark:text-amber-400'
                      : 'text-stone-600 hover:text-stone-950 dark:text-zinc-400 dark:hover:text-stone-100'
                  }`}
                >
                  {d.label}
                </button>
              ))}
            </div>
            <span className="font-num text-xs text-stone-500 dark:text-zinc-400">
              共 {filteredKnowledge.length} 项跨学科关联词条
            </span>
          </div>

          {/* Curated Knowledge Entries Grid */}
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {filteredKnowledge.map((item, idx) => (
              <article
                key={item.id}
                className="flex flex-col justify-between border border-stone-200 bg-[#FBF9F5] p-6 transition-colors hover:border-[#78350F]/50 dark:border-zinc-800 dark:bg-[#111317] dark:hover:border-amber-500/50"
              >
                <div>
                  <div className="flex flex-wrap items-center gap-x-2 text-xs text-stone-500 dark:text-zinc-400">
                    <span className="font-num font-semibold text-[#78350F] dark:text-amber-400">
                      {String(idx + 1).padStart(2, '0')}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>{item.disciplineLabel}</span>
                    <span aria-hidden="true">·</span>
                    <span>{item.chapterHint}</span>
                  </div>

                  <h2 className="font-editorial mt-2.5 text-xl font-semibold text-stone-950 dark:text-stone-100">
                    {item.title}
                  </h2>
                  <p className="font-editorial mt-0.5 text-xs italic text-stone-500 dark:text-zinc-400">
                    {item.subtitle}
                  </p>

                  <p className="mt-3.5 text-sm leading-relaxed text-stone-700 dark:text-stone-300">
                    {item.summary}
                  </p>

                  <div className="mt-3.5 border-t border-stone-200/70 pt-3 text-xs leading-relaxed text-stone-600 dark:border-zinc-800/80 dark:text-zinc-400">
                    <span className="font-semibold text-stone-800 dark:text-stone-200">书内联系：</span>
                    {item.bookConnection}
                  </div>

                  <p className="mt-2 text-xs text-stone-500 dark:text-zinc-500">
                    延伸源流：{item.referenceWork}
                  </p>
                </div>

                <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-stone-200/70 pt-4 dark:border-zinc-800/80">
                  <button
                    type="button"
                    onClick={() => onJumpToSection(item.linkedSectionIds[0] || 'ch-1')}
                    className="inline-flex items-center gap-1 text-xs font-medium text-stone-600 transition-colors hover:text-[#78350F] dark:text-zinc-400 dark:hover:text-amber-400 cursor-pointer"
                  >
                    <span>跳转原著对应章节</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>

                  <button
                    type="button"
                    onClick={() => onLearnText(item.explorePrompt, 'explore')}
                    data-testid={`explore-item-btn-${item.id}`}
                    className="inline-flex items-center gap-1.5 rounded-md border border-[#78350F]/40 bg-[#F3EFE6] px-3 py-1.5 text-xs font-medium text-[#78350F] transition-colors hover:bg-[#78350F] hover:text-[#FBF9F5] dark:border-amber-500/40 dark:bg-zinc-900 dark:text-amber-400 dark:hover:bg-amber-600 dark:hover:text-stone-950 cursor-pointer"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    <span>请老师深度延展</span>
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {/* TAB 2: Compounding Simulator Lab */}
      {activeTab === 'simulator' && (
        <section className="mt-8 space-y-10" aria-label="复利沙盘实验室">
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
            {/* Controls Column */}
            <div className="space-y-6 border border-stone-200 bg-[#F3EFE6]/50 p-6 dark:border-zinc-800 dark:bg-[#111317] lg:col-span-4">
              <div className="flex items-center gap-2 text-xs font-semibold tracking-wider text-[#78350F] uppercase dark:text-amber-400">
                <Sliders className="h-4 w-4" />
                <span>复利参数调节</span>
              </div>

              <div>
                <div className="flex items-baseline justify-between">
                  <label htmlFor="sim-rate" className="text-xs font-medium text-stone-700 dark:text-zinc-300">
                    每日微小改变幅度
                  </label>
                  <span
                    data-testid="sim-rate-value"
                    className="font-num text-sm font-semibold text-[#78350F] dark:text-amber-400"
                  >
                    ±{dailyRatePercent.toFixed(1)}% / 天
                  </span>
                </div>
                <input
                  id="sim-rate"
                  data-testid="sim-rate-slider"
                  type="range"
                  min={0.2}
                  max={2.0}
                  step={0.1}
                  value={dailyRatePercent}
                  onChange={(e) => setDailyRatePercent(Number(e.target.value))}
                  className="mt-2 w-full accent-[#78350F] dark:accent-amber-500 cursor-pointer"
                />
                <p className="mt-1 text-[11px] text-stone-500 dark:text-zinc-400">
                  哪怕每天仅进步 0.5%～1%，复利曲线也会在临界点之后迅速拉开代差。
                </p>
              </div>

              <div>
                <div className="flex items-baseline justify-between">
                  <label htmlFor="sim-days" className="text-xs font-medium text-stone-700 dark:text-zinc-300">
                    持续践行周期
                  </label>
                  <span
                    data-testid="sim-days-value"
                    className="font-num text-sm font-semibold text-stone-900 dark:text-stone-100"
                  >
                    {days} 天（约 {(days / 30).toFixed(1)} 个月）
                  </span>
                </div>
                <input
                  id="sim-days"
                  data-testid="sim-days-slider"
                  type="range"
                  min={30}
                  max={730}
                  step={15}
                  value={days}
                  onChange={(e) => setDays(Number(e.target.value))}
                  className="mt-2 w-full accent-[#78350F] dark:accent-amber-500 cursor-pointer"
                />
              </div>

              <div>
                <div className="flex items-baseline justify-between">
                  <label htmlFor="sim-pages" className="text-xs font-medium text-stone-700 dark:text-zinc-300">
                    每日微习惯投入（如阅读页数）
                  </label>
                  <span className="font-num text-sm font-semibold text-stone-900 dark:text-stone-100">
                    {dailyPages} 页 / 天
                  </span>
                </div>
                <input
                  id="sim-pages"
                  type="range"
                  min={5}
                  max={40}
                  step={5}
                  value={dailyPages}
                  onChange={(e) => setDailyPages(Number(e.target.value))}
                  className="mt-2 w-full accent-[#78350F] dark:accent-amber-500 cursor-pointer"
                />
                <p className="mt-1 text-[11px] text-stone-500 dark:text-zinc-400">
                  累计阅读 <strong className="font-num text-stone-800 dark:text-stone-200">{sim.cumulativeEffortUnits.toLocaleString()}</strong> 页 ≈{' '}
                  <strong className="font-num text-stone-800 dark:text-stone-200">{(sim.cumulativeEffortUnits / 250).toFixed(1)}</strong> 本深度好书。
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  onLearnText(
                    `我在复利沙盘里推演了「每天进步 ${dailyRatePercent.toFixed(1)}%、持续 ${days} 天」，正向倍数达到 ${formatMultiplier(sim.positiveMultiplier)}，而每天松懈 ${dailyRatePercent.toFixed(1)}% 会滑落到 ${formatMultiplier(sim.negativeMultiplier)}。请结合《微小的优势》帮我解读这一推演背后的临界点心理学，以及我如何熬过前 ${sim.tippingPointDay} 天翻倍之前的潜伏期。`,
                    'explore'
                  )
                }
                className="flex w-full items-center justify-center gap-1.5 rounded-md bg-[#78350F] px-4 py-2.5 text-xs font-medium text-[#FBF9F5] transition-colors hover:bg-[#5C280B] dark:bg-amber-600 dark:text-stone-950 dark:font-semibold dark:hover:bg-amber-500 cursor-pointer"
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span>请老师点评我的复利推演</span>
              </button>
            </div>

            {/* Chart & Live Metrics Column */}
            <div className="space-y-6 lg:col-span-8">
              {/* 4 Key Live Numbers (Unboxed Editorial Metrics) */}
              <div className="grid grid-cols-2 gap-4 border-t border-b border-stone-200 py-5 sm:grid-cols-4 dark:border-zinc-800">
                <div>
                  <p className="text-[11px] text-stone-500 dark:text-zinc-400">正向曲线终点</p>
                  <p
                    data-testid="sim-positive-output"
                    className="font-num mt-1 text-2xl font-semibold text-[#14532D] dark:text-emerald-400"
                  >
                    {formatMultiplier(sim.positiveMultiplier)}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] text-stone-500 dark:text-zinc-400">负向曲线终点</p>
                  <p className="font-num mt-1 text-2xl font-semibold text-[#9A3412] dark:text-orange-400">
                    {formatMultiplier(sim.negativeMultiplier)}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] text-stone-500 dark:text-zinc-400">首次翻倍临界点</p>
                  <p className="font-num mt-1 text-2xl font-semibold text-[#78350F] dark:text-amber-400">
                    第 {sim.tippingPointDay} 天
                  </p>
                </div>
                <div>
                  <p className="text-[11px] text-stone-500 dark:text-zinc-400">正负两条路差距</p>
                  <p className="font-num mt-1 text-2xl font-semibold text-stone-900 dark:text-stone-100">
                    {formatMultiplier(sim.gapRatio)}
                  </p>
                </div>
              </div>

              {/* Dual-Curve SVG Visualization */}
              <div className="border border-stone-200 bg-[#FBF9F5] p-5 dark:border-zinc-800 dark:bg-[#111317]">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs text-stone-500 dark:text-zinc-400">
                  <span className="font-editorial text-sm font-semibold text-stone-900 dark:text-stone-100">
                    成功曲线 vs 失败曲线动态推演（{days} 天）
                  </span>
                  <div className="flex items-center gap-4">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-2 w-4 rounded-xs bg-[#14532D] dark:bg-emerald-400" />
                      <span>微小自律 (+{dailyRatePercent.toFixed(1)}%/日)</span>
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-2 w-4 rounded-xs bg-[#9A3412] dark:bg-orange-400" />
                      <span>微小失误 (-{dailyRatePercent.toFixed(1)}%/日)</span>
                    </span>
                  </div>
                </div>

                <svg
                  viewBox={`0 0 ${chartGeometry.width} ${chartGeometry.height}`}
                  role="img"
                  aria-label="微小优势双曲线复利推演图"
                  className="h-auto w-full text-stone-400 dark:text-zinc-600"
                >
                  {/* Baseline 1.0x */}
                  <line
                    x1={chartGeometry.padLeft}
                    y1={chartGeometry.baselineY}
                    x2={chartGeometry.width - chartGeometry.padRight}
                    y2={chartGeometry.baselineY}
                    stroke="currentColor"
                    strokeDasharray="4 4"
                    strokeWidth="1"
                  />
                  <text
                    x={chartGeometry.padLeft - 8}
                    y={chartGeometry.baselineY + 4}
                    textAnchor="end"
                    className="fill-stone-500 text-[10px] dark:fill-zinc-400"
                  >
                    1.0×
                  </text>

                  {/* Top scale line */}
                  <line
                    x1={chartGeometry.padLeft}
                    y1={chartGeometry.padTop}
                    x2={chartGeometry.width - chartGeometry.padRight}
                    y2={chartGeometry.padTop}
                    stroke="currentColor"
                    strokeOpacity="0.25"
                    strokeWidth="1"
                  />
                  <text
                    x={chartGeometry.padLeft - 8}
                    y={chartGeometry.padTop + 4}
                    textAnchor="end"
                    className="fill-stone-500 text-[10px] dark:fill-zinc-400"
                  >
                    {formatMultiplier(chartGeometry.maxY)}
                  </text>

                  {/* Positive area tint */}
                  <path
                    d={chartGeometry.posArea}
                    className="fill-[#14532D]/10 dark:fill-emerald-500/15"
                  />

                  {/* Negative curve */}
                  <path
                    d={chartGeometry.negPath}
                    fill="none"
                    className="stroke-[#9A3412] dark:stroke-orange-400"
                    strokeWidth="2.2"
                  />

                  {/* Positive curve */}
                  <path
                    d={chartGeometry.posPath}
                    fill="none"
                    className="stroke-[#14532D] dark:stroke-emerald-400"
                    strokeWidth="2.6"
                  />

                  {/* Tipping point marker (2x) */}
                  <line
                    x1={chartGeometry.tippingX}
                    y1={chartGeometry.padTop}
                    x2={chartGeometry.tippingX}
                    y2={chartGeometry.height - chartGeometry.padBottom}
                    className="stroke-[#78350F]/45 dark:stroke-amber-400/45"
                    strokeDasharray="3 3"
                    strokeWidth="1"
                  />
                  <circle
                    cx={chartGeometry.tippingX}
                    cy={chartGeometry.tippingY}
                    r="4"
                    className="fill-[#78350F] dark:fill-amber-400"
                  />
                  <text
                    x={Math.min(chartGeometry.width - 110, chartGeometry.tippingX + 8)}
                    y={Math.max(chartGeometry.padTop + 14, chartGeometry.tippingY - 8)}
                    className="fill-[#78350F] text-[10px] font-semibold dark:fill-amber-400"
                  >
                    第 {sim.tippingPointDay} 天突破 2×
                  </text>

                  {/* X-axis labels */}
                  <text
                    x={chartGeometry.padLeft}
                    y={chartGeometry.height - 12}
                    className="fill-stone-500 text-[10px] dark:fill-zinc-400"
                  >
                    第 0 天
                  </text>
                  <text
                    x={chartGeometry.padLeft + chartGeometry.plotW / 2}
                    y={chartGeometry.height - 12}
                    textAnchor="middle"
                    className="fill-stone-500 text-[10px] dark:fill-zinc-400"
                  >
                    第 {Math.round(sim.days / 2)} 天
                  </text>
                  <text
                    x={chartGeometry.width - chartGeometry.padRight}
                    y={chartGeometry.height - 12}
                    textAnchor="end"
                    className="fill-stone-500 text-[10px] dark:fill-zinc-400"
                  >
                    第 {sim.days} 天
                  </text>
                </svg>
              </div>
            </div>
          </div>

          {/* Chapter 3 Classic Comparison: Penny Doubled vs $1,000,000 */}
          <div className="border-t border-stone-200 pt-8 dark:border-zinc-800">
            <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
              <div>
                <p className="text-xs tracking-[0.18em] text-[#78350F] uppercase dark:text-amber-400">
                  Chapter 3 Benchmark · 一美分翻倍实验
                </p>
                <h2 className="font-editorial mt-1 text-2xl font-semibold text-stone-950 dark:text-stone-100">
                  立刻拿走 100 万美元，还是拿 1 美分每天翻倍坚持 31 天？
                </h2>
              </div>
              <button
                type="button"
                onClick={() => onJumpToSection('ch-3')}
                className="inline-flex items-center gap-1 text-xs font-medium text-[#78350F] hover:underline dark:text-amber-400 whitespace-nowrap cursor-pointer"
              >
                <span>回看第 3 章原著</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="mt-5 overflow-x-auto border border-stone-200 dark:border-zinc-800">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-stone-200 bg-[#F3EFE6]/80 text-stone-600 dark:border-zinc-800 dark:bg-[#14161A] dark:text-zinc-400">
                  <tr>
                    <th className="px-4 py-3 font-semibold">天数</th>
                    <th className="px-4 py-3 font-semibold">一美分每日翻倍</th>
                    <th className="px-4 py-3 font-semibold">固定 100 万美元</th>
                    <th className="px-4 py-3 font-semibold">复利阶段解读</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-200/70 dark:divide-zinc-800/80">
                  {PENNY_MILESTONE_DAYS.map((dayNum) => {
                    const row = pennySeries[dayNum - 1];
                    const surpassed = row.doubledDollars >= row.lumpSumDollars;
                    const note =
                      dayNum <= 10
                        ? '潜伏期：看起来微不足道，最容易怀疑与放弃'
                        : dayNum <= 20
                        ? '蓄力期：仍不到固定选项的 1%，旁人看不出差异'
                        : dayNum <= 25
                        ? '拐点逼近：曲线开始明显抬头，进入加速通道'
                        : dayNum === 28
                        ? '一举反超！前 27 天所有的沉寂在此刻兑现'
                        : '垂直爆发：第 31 天突破 1,073 万美元，十倍超越';
                    return (
                      <tr
                        key={dayNum}
                        className={
                          surpassed
                            ? 'bg-[#14532D]/5 dark:bg-emerald-950/20'
                            : 'bg-[#FBF9F5] dark:bg-[#0B0C0E]'
                        }
                      >
                        <td className="font-num px-4 py-2.5 font-semibold text-stone-900 dark:text-stone-100">
                          第 {dayNum} 天
                        </td>
                        <td
                          className={`font-num px-4 py-2.5 font-semibold ${
                            surpassed
                              ? 'text-[#14532D] dark:text-emerald-400'
                              : 'text-stone-700 dark:text-stone-300'
                          }`}
                        >
                          ${row.doubledDollars.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="font-num px-4 py-2.5 text-stone-500 dark:text-zinc-400">
                          $1,000,000.00
                        </td>
                        <td className="px-4 py-2.5 text-stone-600 dark:text-zinc-400">{note}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {/* TAB 3: Core Philosophy Maxims Anthology */}
      {activeTab === 'maxims' && (
        <section className="mt-8" aria-label="核心哲学箴言录">
          <div
            role="group"
            aria-label="哲学主题筛选"
            className="flex flex-wrap items-center gap-1.5 rounded-md bg-[#EBE6DF] p-0.5 w-fit dark:bg-zinc-900"
          >
            {MAXIM_THEMES.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setMaximFilter(t.id)}
                className={`rounded-[5px] px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  maximFilter === t.id
                    ? 'bg-[#FBF9F5] text-stone-950 shadow-xs dark:bg-zinc-800 dark:text-amber-400'
                    : 'text-stone-600 hover:text-stone-900 dark:text-zinc-400 dark:hover:text-stone-100'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="mt-6 divide-y divide-stone-200 dark:divide-zinc-800">
            {filteredMaxims.map((item, idx) => (
              <article key={item.id} className="py-7">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-stone-500 dark:text-zinc-400">
                  <div className="flex items-center gap-2">
                    <span className="font-num font-semibold text-[#78350F] dark:text-amber-400">
                      {String(idx + 1).padStart(2, '0')}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>{item.themeLabel}</span>
                    <span aria-hidden="true">·</span>
                    <span>{item.chapterLabel}</span>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={() => onLearnText(item.en, 'article')}
                      className="inline-flex items-center gap-1 text-xs font-medium text-stone-600 hover:text-[#78350F] dark:text-zinc-400 dark:hover:text-amber-400 cursor-pointer"
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      <span>英文精讲</span>
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        onSaveHighlight({
                          sectionId: item.sectionId,
                          sectionTitleZh: item.chapterLabel,
                          text: `${item.zh}\n${item.en}`,
                          note: `摘自核心哲学箴言录 · ${item.themeLabel}`,
                        })
                      }
                      className="inline-flex items-center gap-1 text-xs font-medium text-stone-600 hover:text-[#78350F] dark:text-zinc-400 dark:hover:text-amber-400 cursor-pointer"
                    >
                      <Bookmark className="h-3.5 w-3.5" />
                      <span>收藏摘录</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onJumpToSection(item.sectionId)}
                      className="inline-flex items-center gap-1 text-xs font-medium text-[#78350F] hover:underline dark:text-amber-400 cursor-pointer"
                    >
                      <span>前往本章精读</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                <blockquote className="mt-4">
                  <p className="font-editorial text-xl font-medium leading-relaxed text-stone-900 sm:text-2xl dark:text-stone-100">
                    “{item.zh}”
                  </p>
                  <p className="font-editorial mt-2 text-sm italic leading-relaxed text-stone-500 sm:text-base dark:text-zinc-400">
                    “{item.en}”
                  </p>
                </blockquote>
              </article>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
