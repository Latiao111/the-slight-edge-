import { Menu, X } from 'lucide-react';
import { useState } from 'react';
import type { AppView } from '../types/book';

interface HeaderProps {
  activeView: AppView;
  onNavigate: (view: AppView) => void;
  onPrimaryAction: () => void;
  hasUntranslatedChapters: boolean;
}

const NAV_ITEMS: { view: AppView; label: string }[] = [
  { view: 'overview', label: '目录总览' },
  { view: 'reader', label: '正文精读' },
  { view: 'maxims', label: '核心哲学' },
  { view: 'export', label: '全书导出' },
];

export function Header({
  activeView,
  onNavigate,
  onPrimaryAction,
  hasUntranslatedChapters,
}: HeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleNavClick = (view: AppView) => {
    onNavigate(view);
    setMobileMenuOpen(false);
  };

  return (
    <header className="sticky top-0 z-40 border-b border-stone-200/80 bg-[#FBF9F5]/95 backdrop-blur-sm">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-8 px-4 py-3.5 sm:px-8">
        {/* Zone 1: Single-element Brand Wordmark */}
        <button
          type="button"
          onClick={() => handleNavClick('overview')}
          className="font-editorial text-xl font-semibold tracking-tight text-stone-900 transition-colors hover:text-[#78350F] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#78350F] whitespace-nowrap shrink-0 cursor-pointer"
        >
          微小的优势
        </button>

        {/* Zone 2: 4 concise single-line navigation links */}
        <nav aria-label="主导航" className="hidden md:flex items-center gap-7 text-sm font-medium text-stone-600">
          {NAV_ITEMS.map((item) => {
            const isActive = activeView === item.view;
            return (
              <button
                key={item.view}
                type="button"
                onClick={() => handleNavClick(item.view)}
                className={`relative py-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#78350F] ${
                  isActive
                    ? 'text-stone-950 font-semibold'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                {item.label}
                {isActive && (
                  <span
                    aria-hidden="true"
                    className="absolute inset-x-0 -bottom-0.5 h-[1.5px] bg-[#78350F]"
                  />
                )}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: 1 primary action + mobile menu trigger */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={onPrimaryAction}
            className="rounded-md bg-[#1C1917] px-4 py-2 text-xs font-medium text-[#FBF9F5] transition-colors hover:bg-[#78350F] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#78350F] whitespace-nowrap shrink-0 cursor-pointer"
          >
            {hasUntranslatedChapters ? '继续精读' : '阅读全书'}
          </button>

          <button
            type="button"
            aria-label={mobileMenuOpen ? '关闭导航菜单' : '打开导航菜单'}
            aria-expanded={mobileMenuOpen}
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            className="flex h-10 w-10 items-center justify-center rounded-md border border-stone-200 text-stone-700 hover:bg-stone-100 md:hidden cursor-pointer"
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile navigation panel */}
      {mobileMenuOpen && (
        <nav
          aria-label="移动端导航"
          className="border-t border-stone-200 bg-[#FBF9F5] px-4 py-3 md:hidden"
        >
          <div className="flex flex-col gap-1">
            {NAV_ITEMS.map((item) => {
              const isActive = activeView === item.view;
              return (
                <button
                  key={item.view}
                  type="button"
                  onClick={() => handleNavClick(item.view)}
                  className={`flex min-h-[44px] items-center justify-between rounded-md px-3 text-left text-sm font-medium transition-colors cursor-pointer ${
                    isActive
                      ? 'bg-[#F3EFE6] text-[#78350F] font-semibold'
                      : 'text-stone-700 hover:bg-stone-100'
                  }`}
                >
                  <span>{item.label}</span>
                  {isActive && <span className="text-xs text-[#78350F]">当前</span>}
                </button>
              );
            })}
          </div>
        </nav>
      )}
    </header>
  );
}
