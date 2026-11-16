export function MonographFrontispiece({
  translatedPercentage,
}: {
  translatedPercentage: number;
}) {
  return (
    <div className="relative flex flex-col justify-between border border-stone-300/90 bg-[#F3EFE6] p-8 sm:p-10">
      <div className="flex items-center justify-between gap-4 border-b border-stone-300/80 pb-4 text-[11px] tracking-widest text-stone-500">
        <span className="truncate">GREENLEAF · 8TH EDITION</span>
        <span className="font-num whitespace-nowrap shrink-0">译本进度 {translatedPercentage}%</span>
      </div>

      <div className="my-8 flex flex-col items-center text-center">
        <p className="text-xs tracking-[0.25em] text-stone-500 uppercase">
          Jeff Olson · John David Mann
        </p>
        <h2 className="font-editorial mt-4 text-4xl font-semibold tracking-tight text-stone-900 sm:text-5xl">
          微小的优势
        </h2>
        <p className="font-editorial mt-2 text-lg italic text-[#78350F]">
          The Slight Edge
        </p>

        {/* Minimalist SVG Curve Illustration representing Compounding Growth vs Decline */}
        <svg
          viewBox="0 0 360 150"
          className="mt-8 w-full max-w-sm"
          role="img"
          aria-label="微小的优势复利曲线示意图"
        >
          <line x1="24" y1="75" x2="336" y2="75" stroke="#D6CEBE" strokeWidth="1" strokeDasharray="4 4" />
          <path
            d="M 28 74 C 130 74, 240 62, 332 16"
            fill="none"
            stroke="#14532D"
            strokeWidth="2.2"
          />
          <path
            d="M 28 76 C 130 76, 240 88, 332 134"
            fill="none"
            stroke="#9A3412"
            strokeWidth="1.6"
            strokeDasharray="3 3"
          />
          <circle cx="28" cy="75" r="3.5" fill="#78350F" />
          <circle cx="332" cy="16" r="4" fill="#14532D" />
          <text x="200" y="34" fontSize="11" fill="#14532D" fontFamily="sans-serif">
            简单的日常自律 × 时间
          </text>
          <text x="195" y="128" fontSize="11" fill="#9A3412" fontFamily="sans-serif">
            微小的判断失误 × 时间
          </text>
        </svg>
      </div>

      <div className="border-t border-stone-300/80 pt-4 text-center text-xs leading-relaxed text-stone-600">
        做起来容易，不做也容易——时间的力量会放大你每日的微小选择
      </div>
    </div>
  );
}

export function RollerCoasterDiagram() {
  return (
    <figure className="my-8 border border-stone-200 bg-[#F3EFE6]/70 p-6">
      <svg
        viewBox="0 0 560 220"
        className="w-full"
        role="img"
        aria-label="人生过山车曲线图：成功线、生存线与失败线"
      >
        {/* Horizontal reference lines */}
        <line x1="56" y1="44" x2="528" y2="44" stroke="#14532D" strokeWidth="1.2" strokeDasharray="5 4" />
        <line x1="56" y1="112" x2="528" y2="112" stroke="#78350F" strokeWidth="1.2" strokeDasharray="4 4" />
        <line x1="56" y1="180" x2="528" y2="180" stroke="#9A3412" strokeWidth="1.2" strokeDasharray="5 4" />

        {/* Labels */}
        <text x="10" y="48" fontSize="12" fill="#14532D" fontWeight="600">成功线</text>
        <text x="10" y="116" fontSize="12" fill="#78350F" fontWeight="600">生存线</text>
        <text x="10" y="184" fontSize="12" fill="#9A3412" fontWeight="600">失败线</text>

        {/* Roller coaster sine wave between failure and survival */}
        <path
          d="M 64 172 C 92 172, 108 102, 138 102 C 168 102, 184 170, 214 170 C 244 170, 260 100, 290 100 C 320 100, 336 168, 366 168"
          fill="none"
          stroke="#57534E"
          strokeWidth="2"
        />

        {/* Breakthrough continuation up to success line */}
        <path
          d="M 290 100 C 335 100, 395 72, 495 36"
          fill="none"
          stroke="#14532D"
          strokeWidth="2.4"
        />

        <circle cx="290" cy="100" r="4" fill="#78350F" />
        <circle cx="495" cy="36" r="4.5" fill="#14532D" />

        <text x="120" y="198" fontSize="11" fill="#57534E">
          绝大多数人停下行动，在失败与生存之间反复摆荡
        </text>
        <text x="342" y="30" fontSize="11" fill="#14532D" fontWeight="600">
          继续坚持同一组微小行动 → 突破至成功线
        </text>
      </svg>
      <figcaption className="mt-3 text-center text-xs text-stone-500 font-editorial italic">
        图 1 · 逃离“过山车诅咒”：把你带到生存线的行动，只要坚持做下去，就会把你带到成功线
      </figcaption>
    </figure>
  );
}

export function TwoPathsDiagram() {
  return (
    <figure className="my-8 border border-stone-200 bg-[#F3EFE6]/70 p-6">
      <svg
        viewBox="0 0 560 220"
        className="w-full"
        role="img"
        aria-label="两条人生轨迹曲线：成功曲线与失败曲线"
      >
        <line x1="48" y1="110" x2="528" y2="110" stroke="#D6CEBE" strokeWidth="1" />
        <path
          d="M 56 108 C 190 108, 340 94, 512 24"
          fill="none"
          stroke="#14532D"
          strokeWidth="2.5"
        />
        <path
          d="M 56 112 C 190 112, 340 126, 512 196"
          fill="none"
          stroke="#9A3412"
          strokeWidth="2.2"
          strokeDasharray="5 3"
        />
        <circle cx="56" cy="110" r="4" fill="#1C1917" />
        <text x="64" y="98" fontSize="11" fill="#57534E">起点几乎重叠，初期难以察觉差异</text>
        <text x="330" y="34" fontSize="12" fill="#14532D" fontWeight="600">5% 成功曲线（担当 · 面向未来）</text>
        <text x="325" y="196" fontSize="12" fill="#9A3412" fontWeight="600">95% 失败曲线（责怪 · 沉溺过去）</text>
      </svg>
      <figcaption className="mt-3 text-center text-xs text-stone-500 font-editorial italic">
        图 2 · 两条人生轨迹：日常微小选择的几何复利最终将两条曲线彻底拉开
      </figcaption>
    </figure>
  );
}
