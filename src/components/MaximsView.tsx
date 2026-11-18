import { ArrowRight } from 'lucide-react';
import { useState } from 'react';
import type { MaximItem } from '../types/book';

interface MaximsViewProps {
  maxims: MaximItem[];
  onJumpToSection: (sectionId: string) => void;
}

const THEMES: { id: 'all' | MaximItem['theme']; label: string }[] = [
  { id: 'all', label: '全部箴言' },
  { id: 'philosophy', label: '哲学与态度' },
  { id: 'time', label: '时间与复利' },
  { id: 'habits', label: '习惯与自律' },
  { id: 'happiness', label: '幸福与涟漪' },
];

export function MaximsView({ maxims, onJumpToSection }: MaximsViewProps) {
  const [filter, setFilter] = useState<'all' | MaximItem['theme']>('all');

  const filtered =
    filter === 'all' ? maxims : maxims.filter((item) => item.theme === filter);

  return (
    <main className="mx-auto max-w-5xl px-4 py-10 sm:px-8 sm:py-14">
      <header className="border-b border-stone-200 pb-8 dark:border-zinc-800">
        <p className="text-xs tracking-[0.2em] text-stone-500 uppercase dark:text-zinc-400">
          Core Philosophy Anthology
        </p>
        <h1 className="font-editorial mt-2 text-3xl font-semibold text-stone-950 sm:text-4xl text-balance dark:text-stone-100">
          全书核心哲学箴言录
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-stone-600 dark:text-zinc-400">
          杰夫·奥尔森在《微小的优势》第二章建议：每当读到直指哲学本质的句子，就把它高亮摘录下来反复重温。这里汇集了全书最具穿透力的双语核心命题，点击任意一条即可直达对应章节精读。
        </p>

        {/* Interactive Filter Tabs */}
        <div
          role="tablist"
          aria-label="哲学主题筛选"
          className="mt-6 flex flex-wrap items-center gap-1.5 rounded-lg bg-[#EBE6DF] p-1 w-fit dark:bg-zinc-900"
        >
          {THEMES.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={filter === t.id}
              onClick={() => setFilter(t.id)}
              className={`rounded-md px-3.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                filter === t.id
                  ? 'bg-[#FBF9F5] text-stone-950 shadow-xs dark:bg-zinc-800 dark:text-amber-400'
                  : 'text-stone-600 hover:text-stone-900 dark:text-zinc-400 dark:hover:text-stone-100'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </header>

      <section className="mt-8 divide-y divide-stone-200 dark:divide-zinc-800">
        {filtered.map((item, idx) => (
          <article key={item.id} className="py-8">
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
              <button
                type="button"
                onClick={() => onJumpToSection(item.sectionId)}
                className="inline-flex items-center gap-1 text-xs font-medium text-[#78350F] hover:underline dark:text-amber-400 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <span>前往本章精读</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>

            <blockquote className="mt-4">
              <p className="font-editorial text-xl font-medium leading-relaxed text-stone-900 sm:text-2xl dark:text-stone-100">
                “{item.zh}”
              </p>
              <p className="font-editorial mt-2.5 text-sm italic leading-relaxed text-stone-500 sm:text-base dark:text-zinc-400">
                “{item.en}”
              </p>
            </blockquote>
          </article>
        ))}
      </section>
    </main>
  );
}
