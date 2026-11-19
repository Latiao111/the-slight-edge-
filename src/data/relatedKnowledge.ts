import type { RelatedKnowledgeItem } from '../types/book';

export const RELATED_KNOWLEDGE_ITEMS: RelatedKnowledgeItem[] = [
  {
    id: 'k-compounding-math',
    title: '指数复利与“一美分翻倍”效应',
    subtitle: 'Exponential Compounding & The Penny Doubled',
    discipline: 'compounding',
    disciplineLabel: '数学与复利模型',
    linkedSectionIds: ['ch-3', 'ch-5', 'ch-9'],
    chapterHint: '第 3、5、9 章',
    summary:
      '复利最反直觉的特征在于“前期几乎不可见、后期呈垂直爆发”。1 美分每天翻倍，前 20 天仅有五千余美元，却在第 31 天跃升至 1,073 万美元；每天进步 1%，一年后累积为 37.78 倍。',
    bookConnection:
      '杰夫·奥尔森用“一美分翻倍”与“水塘睡莲”比喻解释：为什么 95% 的人在前 90 天看不到成果就中途放弃——他们恰好倒在了复利曲线向上弯折的临界点之前。',
    referenceWork: '阿尔伯特·爱因斯坦（传）“世界第八大奇迹” / 摩根·豪泽尔《金钱心理学》',
    explorePrompt:
      '请结合《微小的优势》里的“一美分翻倍”与指数复利规律，讲透为什么日常积累存在漫长的“潜伏期”，以及如何从数学和认知偏差的角度理解非线性增长，并推荐 1~2 本相关的经典延伸书目。',
  },
  {
    id: 'k-plateau-of-latent-potential',
    title: '潜能蓄力平台与“冰块融化”临界点',
    subtitle: 'Plateau of Latent Potential vs. Quantum Leap Myth',
    discipline: 'compounding',
    disciplineLabel: '数学与复利模型',
    linkedSectionIds: ['ch-4', 'ch-5', 'ch-6'],
    chapterHint: '第 4、5、6 章',
    summary:
      '将冰块从 -4°C 加热到 -1°C 时，肉眼看不到任何融化，直到到达 0°C 才发生相变。所有看似“一夜成名”的量子飞跃，本质上都是长期能量蓄积后的相变释放。',
    bookConnection:
      '第 6 章批判了迷信“量子飞跃”的危险：期待速成的人会不断更换方法，导致每次都把温度重新归零，永远等不到自己的 0°C 临界点。',
    referenceWork: '詹姆斯·克利尔《原子习惯（Atomic Habits）》/ 马尔科姆·格拉德威尔《引爆点》',
    explorePrompt:
      '请把《微小的优势》第 6 章反对“量子飞跃”的观点，与《原子习惯》里的“潜能蓄力平台（冰块融化效应）”和物理学相变做一次跨学科对比讲解，帮我彻底理解为什么不能急于求成。',
  },
  {
    id: 'k-emerson-compensation',
    title: '爱默生《论报偿》与超验主义行动观',
    subtitle: 'Ralph Waldo Emerson · Self-Reliance & Compensation',
    discipline: 'books',
    disciplineLabel: '思想家与延伸书单',
    linkedSectionIds: ['ch-1', 'ch-2'],
    chapterHint: '第 1、2 章题记',
    summary:
      '19 世纪美国思想家爱默生提出“报偿法则（Law of Compensation）”：宇宙中每一次付出与行动都有必然对等的回响，“先去做那件事，然后你才会拥有力量”。',
    bookConnection:
      '全书第 1 章与第 2 章连续引用爱默生名言作为开篇定调：不是先拥有信心、天赋或力量才开始行动，恰恰是微小的持续行动反过来塑造了力量与自我身份。',
    referenceWork: '拉尔夫·沃尔多·爱默生《论自助（Self-Reliance）》《论报偿（Compensation）》',
    explorePrompt:
      '《微小的优势》前两章连续引用了拉尔夫·沃尔多·爱默生的话。请介绍爱默生是谁、他的《论报偿》与《论自助》核心思想是什么，以及“先行动再获得力量”对现代普通人有什么心理学启发。',
  },
  {
    id: 'k-philosophy-attitude-action',
    title: '认知行为三角：哲学 → 态度 → 行动 → 结果',
    subtitle: 'Cognitive Behavioral Loop & Mental Models',
    discipline: 'psychology',
    disciplineLabel: '积极心理学',
    linkedSectionIds: ['ch-2', 'ch-10'],
    chapterHint: '第 2、10 章',
    summary:
      '认知心理学与 CBT（认知行为疗法）指出：决定人类行为的不是客观事件本身，而是我们对事件的底层信念（哲学/图式）。改变表层动作往往难以持久，唯有更新底层哲学才能重塑自动化反应。',
    bookConnection:
      '第 2 章指出“信息本身不会改变人生，‘第一要素’是你的底层人生哲学”。书中的“哲学→态度→行动→结果”链条，与现代认知行为心理学不谋而合。',
    referenceWork: '亚伦·贝克 认知行为疗法（CBT）/ 卡罗尔·德韦克《终身成长（Mindset）》',
    explorePrompt:
      '请从认知心理学（如 CBT 认知行为模型、成长型思维 Mindset）的角度，剖析《微小的优势》第 2 章提出的“哲学 → 态度 → 行动 → 结果”链条，为什么单靠看干货和励志信息很难改变行为？',
  },
  {
    id: 'k-positive-psychology-achor',
    title: '积极心理学与“快乐竞争力”倒置公式',
    subtitle: 'Positive Psychology · Shawn Achor & Martin Seligman',
    discipline: 'psychology',
    disciplineLabel: '积极心理学',
    linkedSectionIds: ['ch-7'],
    chapterHint: '第 7 章',
    summary:
      '传统观念认为“努力工作 → 成功 → 幸福”，但哈佛积极心理学研究者肖恩·阿克尔与“积极心理学之父”马丁·塞利格曼通过大量实证发现：公式恰恰相反，大脑处于积极状态时，创造力、抗压性与生产力可提升 30% 以上。',
    bookConnection:
      '第 7 章完整引入了肖恩·阿克尔的 5 个每日幸福微习惯（每日三件感恩、2 分钟正向日记、冥想、15 分钟运动、每日发一条感谢讯息），把幸福从“遥远的奖品”变成了“日常燃料”。',
    referenceWork: '肖恩·阿克尔《快乐竞争力（The Happiness Advantage）》/ 马丁·塞利格曼《持续的幸福》',
    explorePrompt:
      '请深入讲解《微小的优势》第 7 章引用的肖恩·阿克尔《快乐竞争力》和马丁·塞利格曼积极心理学研究：为什么“先幸福再成功”有神经科学依据？这 5 个幸福微习惯背后各自激活了什么心理机制？',
  },
  {
    id: 'k-ripple-effect-social',
    title: '社会传染与“三度影响力”法则',
    subtitle: 'Social Contagion & Three Degrees of Influence',
    discipline: 'psychology',
    disciplineLabel: '积极心理学',
    linkedSectionIds: ['ch-8', 'ch-13'],
    chapterHint: '第 8、13 章',
    summary:
      '哈佛学者尼古拉斯·克里斯塔基斯与詹姆斯·福勒在长达 32 年的弗雷明汉追踪研究中发现：情绪、幸福感、甚至健康习惯会沿着社交网络传播三层（朋友的朋友的朋友），你的微小改变会无声重塑整个关系圈。',
    bookConnection:
      '第 8 章的“涟漪效应”与第 13 章“你是最常相处的五位朋友的平均值”互为镜像：你既是别人涟漪的接收者，也在每时每刻向外发射正向或负向涟漪。',
    referenceWork: '尼古拉斯·克里斯塔基斯《大连接（Connected）》/ 吉姆·罗恩个人成长演讲录',
    explorePrompt:
      '请结合社会网络学中的“三度影响力法则（《大连接》）”和吉姆·罗恩“五位挚友平均值”观点，深入解读《微小的优势》第 8 章涟漪效应与第 13 章人际圈层选择。',
  },
  {
    id: 'k-habit-loop-autopilot',
    title: '基底核习惯回路与“潜意识自动驾驶”',
    subtitle: 'Basal Ganglia Habit Loop · Cue → Routine → Reward',
    discipline: 'habits',
    disciplineLabel: '行为与习惯科学',
    linkedSectionIds: ['ch-12', 'ch-15'],
    chapterHint: '第 12、15 章',
    summary:
      '神经科学研究表明，人类日常超过 40%～90% 的决策由大脑基底核自动执行以节省葡萄糖能耗。习惯一旦形成便难以被意志力直接“抹除”，最有效的方法是保留触发提示与奖赏，替换中间的惯常行为。',
    bookConnection:
      '第 12 章与第 15 章反复强调“我们 99% 的行为靠自动驾驶仪驱动”，且“消除坏习惯最好的办法是用正向新习惯去替代它”，与行为神经科学的习惯回路理论高度一致。',
    referenceWork: '查尔斯·杜希格《习惯的力量》/ B.J. 福格《福格行为模型（Tiny Habits）》',
    explorePrompt:
      '请结合脑科学中的“习惯回路（提示-惯常行为-奖赏）”和《福格行为模型（Tiny Habits）》，深入讲解《微小的优势》第 12、15 章关于“自动驾驶仪”和“用好习惯替代坏习惯”的实操方法。',
  },
  {
    id: 'k-course-correction-cybernetics',
    title: '控制论与“90% 偏航修正”原理',
    subtitle: 'Cybernetics & Continuous Course Correction',
    discipline: 'habits',
    disciplineLabel: '行为与习惯科学',
    linkedSectionIds: ['ch-12', 'ch-14'],
    chapterHint: '第 12、14 章',
    summary:
      '阿波罗登月飞船与现代民航客机在飞行途中，超过 90% 的时间其实都略微偏离理论直线；它们之所以能精准着陆，靠的是高频传感器反馈与持续微调，而不是一次性完美瞄准。',
    bookConnection:
      '第 12 章用飞行航线比喻个人学习（书本智慧 + 实战智慧双活塞）与第 14 章“反思之力”：允许自己在行动中偏航，只要每天反思并做微小修正，终能抵达目标。',
    referenceWork: '诺伯特·维纳《控制论》/ 麦克斯韦·马尔茨《心理控制术（Psycho-Cybernetics）》',
    explorePrompt:
      '请讲讲《微小的优势》第 12 章“持续微小纠偏”背后的控制论（Cybernetics）与“阿波罗登月 90% 偏航”原理，以及如何把“学中知 + 做中学 + 每日反思”做成自己的反馈闭环。',
  },
  {
    id: 'k-napoleon-hill-mastermind',
    title: '拿破仑·希尔“智囊团”与明确目标法则',
    subtitle: 'Napoleon Hill · Definite Chief Aim & Mastermind Alliance',
    discipline: 'books',
    disciplineLabel: '思想家与延伸书单',
    linkedSectionIds: ['ch-11', 'ch-13', 'ch-16'],
    chapterHint: '第 11、13、16 章',
    summary:
      '拿破仑·希尔历时二十年访谈卡内基、爱迪生、福特等数百位实业家，提炼出“明确主要目标（Definite Chief Aim）”与“智囊团（Mastermind）”概念：两个以上志同道合的大脑协同思考时，会产生超越个体之和的“第三种智慧”。',
    bookConnection:
      '本书第 11、16 章题记直接援引拿破仑·希尔《思考致富》与《成功法则》，第 13 章详细阐释了如何组建属于自己的智囊团与寻找真实导师。',
    referenceWork: '拿破仑·希尔《思考致富（Think and Grow Rich）》《成功法则》',
    explorePrompt:
      '《微小的优势》多次引用拿破仑·希尔并推崇“智囊团（Mastermind）”和“写下明确目标”。请客观介绍拿破仑·希尔的思想精华，去掉鸡汤滤镜，讲讲现代职场人和学习者如何真正组建自己的“智囊团”。',
  },
  {
    id: 'k-deliberate-practice-mastery',
    title: '精进之路与“舒适区边缘”刻意练习',
    subtitle: 'Mastery & Deliberate Practice (Ericsson / Leonard)',
    discipline: 'habits',
    disciplineLabel: '行为与习惯科学',
    linkedSectionIds: ['ch-11', 'ch-12', 'ch-14'],
    chapterHint: '第 11、12、14 章',
    summary:
      '心理学家安德斯·艾利克森与乔治·伦纳德（《精进之路》）指出：精进不是靠机械重复，而是在“略微不适的拉伸区”中爱上漫长的平台期，通过持续反馈与微调完成技能跃迁。',
    bookConnection:
      '第 11 章指出“渴望伴随着不适与阵痛，精进始于踏上道路的那一刻”，与《刻意练习》和《精进之路（Mastery）》一脉相承。',
    referenceWork: '安德斯·艾利克森《刻意练习》/ 乔治·伦纳德《精进之路（Mastery）》',
    explorePrompt:
      '请结合《刻意练习》和乔治·伦纳德《精进之路（Mastery）》中“爱上平台期”的观点，深入解读《微小的优势》第 11 章关于“精通之路”和拥抱不适感的思考。',
  },
  {
    id: 'k-zeigarnik-completion',
    title: '蔡格尼克效应与“完成之力”减负机制',
    subtitle: 'Zeigarnik Effect & Cognitive Load of Open Loops',
    discipline: 'psychology',
    disciplineLabel: '积极心理学',
    linkedSectionIds: ['ch-14'],
    chapterHint: '第 14 章',
    summary:
      '苏联心理学家蔡格尼克发现：大脑对“未完成的任务”会持续占用工作记忆与心理带宽，不断制造隐性焦虑和能量泄漏；把悬而未决的“开放回路（Open Loops）”逐一了结，能立刻释放巨大的专注力。',
    bookConnection:
      '第 14 章把“完成之力（Completion）”列为微小优势的四大同盟军之一：清理过去的未竟之事，才能轻装上阵，把全部动能投入当下。',
    referenceWork: '布鲁玛·蔡格尼克 蔡格尼克记忆效应 / 戴维·艾伦《搞定（GTD）》',
    explorePrompt:
      '请用心理学中的“蔡格尼克效应（Zeigarnik Effect）”和 GTD 中的“开放回路（Open Loops）”理论，深度解读《微小的优势》第 14 章为什么把“完成之力（Completion）”当成极其强大的同盟。',
  },
  {
    id: 'k-implementation-intentions',
    title: '执行意图与“极简起步计划”心理学',
    subtitle: 'Implementation Intentions & Gollwitzer Research',
    discipline: 'books',
    disciplineLabel: '思想家与延伸书单',
    linkedSectionIds: ['ch-16', 'ch-17', 'ch-18'],
    chapterHint: '第 16、17、18 章',
    summary:
      '心理学家彼得·戈尔维策的实证研究表明：仅仅许愿目标成功率很低，而将目标写成具体的“时间 + 地点 + 极简行动（如果 X，我就做 Y）”的书面执行意图，行动兑现率可提升 2～3 倍。',
    bookConnection:
      '第 16 章提出“通往梦想的三步法（写下来、每天看、带极简计划起步）”与第 17 章七大生活领域行动蓝图，强调起始计划的价值不是完美，而是帮你跨出第一步。',
    referenceWork: '彼得·戈尔维策 执行意图理论 / 斯蒂芬·盖斯《微习惯（Mini Habits）》',
    explorePrompt:
      '请结合心理学家彼得·戈尔维策的“执行意图”研究与《微习惯（Mini Habits）》，拆解《微小的优势》第 16、17 章的“三步梦想计划”，并帮我设计一套极简可落地的每日启动模板。',
  },
];

export function getRelatedKnowledgeForSection(sectionId: string): RelatedKnowledgeItem[] {
  const exact = RELATED_KNOWLEDGE_ITEMS.filter((item) =>
    item.linkedSectionIds.includes(sectionId)
  );
  if (exact.length >= 2) return exact;
  const seen = new Set(exact.map((item) => item.id));
  const supplemented = [...exact];
  for (const fallback of RELATED_KNOWLEDGE_ITEMS) {
    if (seen.has(fallback.id)) continue;
    supplemented.push(fallback);
    seen.add(fallback.id);
    if (supplemented.length >= 2) break;
  }
  return supplemented;
}
