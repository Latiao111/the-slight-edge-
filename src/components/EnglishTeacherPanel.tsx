import {
  AlertCircle,
  Bookmark,
  Check,
  Cloud,
  Download,
  ExternalLink,
  FileText,
  FolderOpen,
  GraduationCap,
  Loader2,
  LogOut,
  MessageSquarePlus,
  PanelRightClose,
  RefreshCw,
  Sparkles,
  Square,
  X,
} from 'lucide-react';
import { type KeyboardEvent, type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import type { User } from 'firebase/auth';
import {
  clearDriveAccessToken,
  getDriveAccessToken,
  initGoogleAuth,
  signInWithGoogleDrive,
  signOutGoogleDrive,
} from '../lib/googleAuth';
import { openGoogleDrivePicker, type PickerPurpose } from '../lib/googlePicker';
import type { TeacherMessage, TeacherMode } from '../types/book';
import { truncateStudyMaterial } from '../utils/pickerHelpers';
import {
  buildStudyNoteFilename,
  buildStudyNoteMarkdownDocument,
  inferTeacherModeFromText,
  type DriveTemplateInfo,
} from '../utils/teacherBot';

const TEACHER_MESSAGES_STORAGE_KEY = 'slight_edge_teacher_messages_v1';

function readStoredTeacherMessages(): TeacherMessage[] {
  try {
    const raw = window.localStorage.getItem(TEACHER_MESSAGES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (m): m is TeacherMessage =>
          Boolean(m) &&
          typeof m === 'object' &&
          (m.role === 'user' || m.role === 'model') &&
          typeof m.text === 'string' &&
          m.text.trim().length > 0
      )
      .slice(-40);
  } catch {
    return [];
  }
}

export interface TeacherLaunchRequest {
  id: number;
  text: string;
  mode?: TeacherMode;
}

interface EnglishTeacherPanelProps {
  isOpen: boolean;
  fullHeight?: boolean;
  onToggleOpen: (open: boolean) => void;
  sectionTitleZh?: string;
  sectionTitleEn?: string;
  launchRequest?: TeacherLaunchRequest | null;
  onSaveCard?: (params: {
    mode: TeacherMode;
    prompt: string;
    content: string;
    sectionTitleZh?: string;
    silent?: boolean;
  }) => void;
}

const STARTER_PROMPTS: Record<TeacherMode, { label: string; text: string }[]> = {
  vocab: [
    { label: 'slight edge', text: 'slight edge' },
    { label: 'simple daily disciplines', text: 'simple daily disciplines' },
    { label: 'compound interest', text: 'compound interest' },
  ],
  article: [
    {
      label: '精读：Easy to do, easy not to do.',
      text: 'The same things that are easy to do are also easy not to do.',
    },
    {
      label: '精读：第 1 章转折关键句',
      text: 'I didn’t change who I was as much as I changed what I did.',
    },
  ],
  explore: [
    {
      label: '延伸：微小的优势 vs《原子习惯》潜能平台',
      text: '请把《微小的优势》里的复利曲线与《原子习惯》的“潜能蓄力平台”做一次深度对比，讲清楚为什么前 90 天很难看到成果。',
    },
    {
      label: '延伸：爱默生“先行动，再获得力量”',
      text: '《微小的优势》开篇引用爱默生“Do the thing, and you shall have the power”。请从心理学和思想史角度深度解析这句话。',
    },
    {
      label: '延伸：肖恩·阿克尔积极心理学幸福微习惯',
      text: '请延伸讲解《微小的优势》第 7 章提到的肖恩·阿克尔积极心理学研究：为什么“先幸福再成功”更有科学依据？',
    },
  ],
};

function renderInlineFormatted(text: string): ReactNode[] {
  const tokens: ReactNode[] = [];
  const regex = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let keyIdx = 0;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      tokens.push(text.slice(lastIndex, match.index));
    }
    const token = match[0];
    if (token.startsWith('`') && token.endsWith('`')) {
      tokens.push(
        <code
          key={keyIdx++}
          className="rounded bg-stone-200/70 px-1 py-0.5 font-num text-[12px] text-[#78350F] dark:bg-zinc-800/90 dark:text-amber-300"
        >
          {token.slice(1, -1)}
        </code>
      );
    } else if (token.startsWith('**') && token.endsWith('**')) {
      tokens.push(
        <strong key={keyIdx++} className="font-semibold text-stone-950 dark:text-stone-100">
          {token.slice(2, -2)}
        </strong>
      );
    } else if (token.startsWith('*') && token.endsWith('*')) {
      tokens.push(
        <em key={keyIdx++} className="italic text-stone-700 dark:text-zinc-300">
          {token.slice(1, -1)}
        </em>
      );
    }
    lastIndex = match.index + token.length;
  }

  if (lastIndex < text.length) {
    tokens.push(text.slice(lastIndex));
  }
  return tokens;
}

function renderTeacherMarkdown(content: string): ReactNode {
  const lines = content.replace(/\r\n/g, '\n').split('\n');
  const elements: ReactNode[] = [];
  let listItems: { ordered: boolean; text: string }[] = [];
  let listKey = 0;

  const flushList = () => {
    if (listItems.length === 0) return;
    const isOrdered = listItems[0].ordered;
    const Tag = isOrdered ? 'ol' : 'ul';
    elements.push(
      <Tag
        key={`list-${listKey++}`}
        className={`my-2 space-y-1.5 pl-4 text-[13.5px] leading-[1.72] text-stone-800 dark:text-stone-200 ${
          isOrdered ? 'list-decimal' : 'list-disc'
        }`}
      >
        {listItems.map((item, idx) => (
          <li key={idx}>{renderInlineFormatted(item.text)}</li>
        ))}
      </Tag>
    );
    listItems = [];
  };

  lines.forEach((rawLine, idx) => {
    const line = rawLine.trim();
    if (!line) {
      flushList();
      return;
    }

    if (/^---+$/.test(line)) {
      flushList();
      elements.push(
        <hr key={`hr-${idx}`} className="my-3 border-stone-200/80 dark:border-zinc-800/80" />
      );
      return;
    }

    const headingMatch = line.match(/^(#{1,4})\s+(.*)$/);
    if (headingMatch) {
      flushList();
      const level = headingMatch[1].length;
      elements.push(
        <h4
          key={`h-${idx}`}
          className={`font-editorial font-semibold text-[#78350F] dark:text-amber-400 ${
            level <= 2 ? 'mt-3.5 mb-1.5 text-[15px]' : 'mt-2.5 mb-1 text-[13.5px]'
          }`}
        >
          {renderInlineFormatted(headingMatch[2])}
        </h4>
      );
      return;
    }

    if (line.startsWith('> ')) {
      flushList();
      elements.push(
        <blockquote
          key={`bq-${idx}`}
          className="my-2 border-t border-b border-stone-200/70 py-1.5 text-[13px] italic text-stone-700 dark:border-zinc-800/80 dark:text-zinc-300"
        >
          {renderInlineFormatted(line.slice(2))}
        </blockquote>
      );
      return;
    }

    const ulMatch = line.match(/^[-*•]\s+(.*)$/);
    if (ulMatch) {
      if (listItems.length > 0 && listItems[0].ordered) flushList();
      listItems.push({ ordered: false, text: ulMatch[1] });
      return;
    }

    const olMatch = line.match(/^\d+[.)]\s+(.*)$/);
    if (olMatch) {
      if (listItems.length > 0 && !listItems[0].ordered) flushList();
      listItems.push({ ordered: true, text: olMatch[1] });
      return;
    }

    flushList();
    elements.push(
      <p
        key={`p-${idx}`}
        className="my-1.5 text-[13.5px] leading-[1.72] text-stone-800 dark:text-stone-200"
      >
        {renderInlineFormatted(line)}
      </p>
    );
  });

  flushList();
  return <div className="space-y-0.5">{elements}</div>;
}

export function EnglishTeacherPanel({
  isOpen,
  fullHeight = false,
  onToggleOpen,
  sectionTitleZh,
  sectionTitleEn,
  launchRequest,
  onSaveCard,
}: EnglishTeacherPanelProps) {
  const [mode, setMode] = useState<TeacherMode>('vocab');
  const [messages, setMessages] = useState<TeacherMessage[]>(readStoredTeacherMessages);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [scrollAnchorTurnId, setScrollAnchorTurnId] = useState<string | null>(null);

  // Google Drive Auth & Template State (token strictly in-memory via googleAuth.ts)
  const [driveUser, setDriveUser] = useState<User | null>(null);
  const [driveConnected, setDriveConnected] = useState(false);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const [vocabTemplate, setVocabTemplate] = useState<DriveTemplateInfo | null>(null);
  const [articleTemplate, setArticleTemplate] = useState<DriveTemplateInfo | null>(null);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false);

  const [autoSaveEnabled, setAutoSaveEnabled] = useState(true);
  const [pendingSaveCount, setPendingSaveCount] = useState(0);
  const [savedCount, setSavedCount] = useState(0);
  const [lastSavedFile, setLastSavedFile] = useState<{
    name: string;
    webViewLink?: string;
  } | null>(null);
  const [isPickingDrive, setIsPickingDrive] = useState<PickerPurpose | null>(null);
  const [pickedMaterial, setPickedMaterial] = useState<{
    id: string;
    name: string;
    mimeType: string;
    folderId?: string;
    webViewLink?: string;
    content: string;
    truncated: boolean;
    originalLength: number;
  } | null>(null);

  const threadContainerRef = useRef<HTMLDivElement | null>(null);
  const turnRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const chatAbortRef = useRef<AbortController | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const messagesRef = useRef<TeacherMessage[]>(messages);
  const lastHandledLaunchIdRef = useRef<number | null>(null);

  messagesRef.current = messages;

  // Persist completed study messages in localStorage so learning content is always retained across reloads
  useEffect(() => {
    if (isStreaming) return;
    try {
      const toStore = messages
        .filter((m) => m.text.trim().length > 0)
        .slice(-40)
        .map((m) => ({
          ...m,
          driveSaveState: m.driveSaveState === 'saving' ? 'idle' : m.driveSaveState,
        }));
      window.localStorage.setItem(TEACHER_MESSAGES_STORAGE_KEY, JSON.stringify(toStore));
    } catch {
      // Ignore storage quota issues
    }
  }, [messages, isStreaming]);

  const handleDownloadMarkdownNote = useCallback(
    (params: {
      msgMode: TeacherMode;
      userPrompt: string;
      markdownContent: string;
      createdAt?: number;
    }) => {
      const date = params.createdAt ? new Date(params.createdAt) : new Date();
      const filename = buildStudyNoteFilename(params.msgMode, params.userPrompt, date);
      const md = buildStudyNoteMarkdownDocument({
        mode: params.msgMode,
        userPrompt: params.userPrompt,
        markdownContent: params.markdownContent,
        sectionTitleZh,
        sectionTitleEn,
        date,
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
    },
    [sectionTitleZh, sectionTitleEn]
  );

  const fetchDriveTemplates = useCallback(async (tokenOverride?: string) => {
    const token = tokenOverride || getDriveAccessToken();
    if (!token) return;

    setIsLoadingTemplates(true);
    setAuthError(null);
    try {
      const res = await fetch('/api/drive/templates', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) {
        clearDriveAccessToken();
        setDriveConnected(false);
        setAuthError('Google Drive 会话已过期，请重新连接。');
        return;
      }
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || '未能读取云端硬盘模板');
      }
      const data = (await res.json()) as {
        vocabTemplate?: DriveTemplateInfo;
        articleTemplate?: DriveTemplateInfo;
      };
      if (data.vocabTemplate) setVocabTemplate(data.vocabTemplate);
      if (data.articleTemplate) setArticleTemplate(data.articleTemplate);
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : '读取云端硬盘格式模板失败。');
    } finally {
      setIsLoadingTemplates(false);
    }
  }, []);

  useEffect(() => {
    const unsubscribe = initGoogleAuth(({ user, accessToken }) => {
      setDriveUser(user);
      setDriveConnected(Boolean(accessToken));
      if (!accessToken) {
        setVocabTemplate(null);
        setArticleTemplate(null);
      }
    });
    return () => unsubscribe();
  }, []);

  // Scroll to the TOP of the newly added turn (user question + teacher's literal translation)
  // and NEVER yank the learner down to the bottom as chunks stream or finish.
  useEffect(() => {
    if (!scrollAnchorTurnId) return;
    const container = threadContainerRef.current;
    const targetEl = turnRefs.current.get(scrollAnchorTurnId);
    if (!container || !targetEl) return;

    const rafId = window.requestAnimationFrame(() => {
      const containerRect = container.getBoundingClientRect();
      const targetRect = targetEl.getBoundingClientRect();
      const targetTop = targetRect.top - containerRect.top + container.scrollTop;
      container.scrollTo({ top: Math.max(0, targetTop - 8), behavior: 'smooth' });
    });
    return () => window.cancelAnimationFrame(rafId);
  }, [scrollAnchorTurnId]);

  useEffect(() => {
    return () => {
      chatAbortRef.current?.abort();
    };
  }, []);

  const handleGoogleSignIn = async () => {
    setIsSigningIn(true);
    setAuthError(null);
    try {
      const { user, accessToken } = await signInWithGoogleDrive();
      setDriveUser(user);
      setDriveConnected(true);
      void fetchDriveTemplates(accessToken);
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Google 登录未完成，请重试。');
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleGoogleSignOut = async () => {
    await signOutGoogleDrive();
    setDriveUser(null);
    setDriveConnected(false);
    setVocabTemplate(null);
    setArticleTemplate(null);
    setPickedMaterial(null);
    setAuthError(null);
  };

  const handleOpenGooglePicker = async (purpose: PickerPurpose) => {
    if (isPickingDrive) return;
    setAuthError(null);
    setIsPickingDrive(purpose);

    try {
      let token = getDriveAccessToken();
      if (!token) {
        const signed = await signInWithGoogleDrive();
        token = signed.accessToken;
        setDriveUser(signed.user);
        setDriveConnected(true);
        void fetchDriveTemplates(token);
      }

      const picked = await openGoogleDrivePicker({ accessToken: token, purpose });
      if (!picked) return;

      const fileRes = await fetch('/api/drive/file', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          fileId: picked.id,
          name: picked.name,
          mimeType: picked.mimeType,
          parentId: picked.parentId,
          webViewLink: picked.url,
        }),
      });

      if (fileRes.status === 401) {
        clearDriveAccessToken();
        setDriveConnected(false);
        setAuthError('Google 授权已过期，请重新登录后使用云端文件选择器。');
        return;
      }

      if (!fileRes.ok) {
        const errBody = await fileRes.json().catch(() => ({}));
        throw new Error(errBody.error || '无法读取所选 Google 云端文档');
      }

      const data = (await fileRes.json()) as {
        file: {
          id: string;
          name: string;
          mimeType: string;
          isFolder: boolean;
          folderId?: string;
          webViewLink?: string;
          content: string;
        };
      };

      const file = data.file;

      if (purpose === 'template') {
        const templateKey = mode === 'vocab' ? 'vocab' : 'article';
        const nextTemplate: DriveTemplateInfo = {
          key: templateKey,
          targetName: file.name,
          found: true,
          fileId: file.id,
          name: file.name,
          mimeType: file.mimeType,
          isFolder: file.isFolder,
          folderId: file.folderId,
          webViewLink: file.webViewLink,
          sampleContent: file.content,
        };
        if (templateKey === 'vocab') {
          setVocabTemplate(nextTemplate);
        } else {
          setArticleTemplate(nextTemplate);
        }
        return;
      }

      if (!file.content || !file.content.trim()) {
        setAuthError(
          `已选择「${file.name}」，但暂未提取到可精读的纯文本内容（建议选择 Google 文档、TXT 或 Markdown 文件）。`
        );
        return;
      }

      const trimmedDoc = truncateStudyMaterial(file.content, 3000);
      setPickedMaterial({
        id: file.id,
        name: file.name,
        mimeType: file.mimeType,
        folderId: file.folderId,
        webViewLink: file.webViewLink,
        content: trimmedDoc.text,
        truncated: trimmedDoc.truncated,
        originalLength: trimmedDoc.originalLength,
      });
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : '打开 Google Picker 选择云端文件失败。');
    } finally {
      setIsPickingDrive(null);
    }
  };

  const saveMessageToDriveInBackground = useCallback(
    async (params: {
      messageId: string;
      msgMode: TeacherMode;
      userPrompt: string;
      markdownContent: string;
    }) => {
      const token = getDriveAccessToken();
      if (!token) return;

      const { messageId, msgMode, userPrompt, markdownContent } = params;
      const targetTemplate =
        msgMode === 'vocab' ? vocabTemplate : msgMode === 'article' ? articleTemplate : null;

      setPendingSaveCount((c) => c + 1);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId ? { ...m, driveSaveState: 'saving', driveError: undefined } : m
        )
      );

      try {
        const res = await fetch('/api/drive/save', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            mode: msgMode,
            userPrompt,
            markdownContent,
            targetFolderId: targetTemplate?.folderId,
            sectionTitleZh,
            sectionTitleEn,
          }),
        });

        if (res.status === 401) {
          clearDriveAccessToken();
          setDriveConnected(false);
          throw new Error('授权已过期，请重新登录');
        }

        if (!res.ok) {
          const errBody = await res.json().catch(() => ({}));
          throw new Error(errBody.error || `保存失败 (${res.status})`);
        }

        const data = (await res.json()) as {
          file: { id: string; name: string; webViewLink?: string };
        };

        setSavedCount((c) => c + 1);
        setLastSavedFile({ name: data.file.name, webViewLink: data.file.webViewLink });
        setMessages((prev) =>
          prev.map((m) =>
            m.id === messageId
              ? {
                  ...m,
                  driveSaveState: 'saved',
                  driveFileName: data.file.name,
                  driveWebViewLink: data.file.webViewLink,
                }
              : m
          )
        );
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : '后台保存失败';
        setMessages((prev) =>
          prev.map((m) =>
            m.id === messageId ? { ...m, driveSaveState: 'error', driveError: errMsg } : m
          )
        );
      } finally {
        setPendingSaveCount((c) => Math.max(0, c - 1));
      }
    },
    [vocabTemplate, articleTemplate, sectionTitleZh, sectionTitleEn]
  );

  const handleSendMessage = useCallback(
    async (overrideText?: string, overrideMode?: TeacherMode) => {
      let trimmed = (overrideText ?? input).trim();
      if (!trimmed && !overrideText) {
        const pageSelected = window.getSelection()?.toString().trim() ?? '';
        if (pageSelected) {
          trimmed = pageSelected;
        }
      }
      if (!trimmed) return;

      // Cancel any in-flight stream cleanly if triggered from a direct learn button
      if (isStreaming && overrideText) {
        chatAbortRef.current?.abort();
      } else if (isStreaming) {
        return;
      }

      setChatError(null);
      if (!overrideText) setInput('');

      const activeMode = overrideMode ?? (overrideText ? inferTeacherModeFromText(trimmed) : mode);
      if (overrideMode || overrideText) {
        setMode(activeMode);
      }
      const activeTemplate =
        activeMode === 'vocab' ? vocabTemplate : activeMode === 'article' ? articleTemplate : null;

      const userMsgId = `user-${Date.now()}`;
      const userMsg: TeacherMessage = {
        id: userMsgId,
        role: 'user',
        text: trimmed,
        mode: activeMode,
        createdAt: Date.now(),
      };

      const assistantMsgId = `model-${Date.now() + 1}`;
      const placeholderAssistant: TeacherMessage = {
        id: assistantMsgId,
        role: 'model',
        text: '',
        mode: activeMode,
        createdAt: Date.now(),
        driveSaveState: 'idle',
      };

      const historyPayload = messagesRef.current
        .filter((m) => m.text.trim().length > 0)
        .map((m) => ({ role: m.role, text: m.text }));

      setMessages((prev) => [...prev, userMsg, placeholderAssistant]);
      setScrollAnchorTurnId(userMsgId);
      setIsStreaming(true);

      chatAbortRef.current?.abort();
      const controller = new AbortController();
      chatAbortRef.current = controller;

      let assembledText = '';

      try {
        const res = await fetch('/api/teacher/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mode: activeMode,
            message: trimmed,
            history: historyPayload,
            template: activeTemplate,
            sectionTitleZh,
            sectionTitleEn,
          }),
          signal: controller.signal,
        });

        if (!res.ok) {
          const errBody = await res.json().catch(() => ({}));
          throw new Error(errBody.error || `请求失败（HTTP ${res.status}）`);
        }

        if (!res.body) {
          throw new Error('服务器未返回流式教学响应。');
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let buffer = '';

        while (true) {
          const { value, done } = await reader.read();
          if (value) {
            buffer += decoder.decode(value, { stream: !done });
          }

          const events = buffer.split('\n\n');
          buffer = done ? '' : (events.pop() ?? '');

          for (const rawEvent of events) {
            if (!rawEvent.trim()) continue;
            const dataLine = rawEvent.split('\n').find((line) => line.startsWith('data: '));
            if (!dataLine) continue;
            try {
              const payload = JSON.parse(dataLine.slice(6)) as {
                type: 'chunk' | 'done' | 'error';
                text?: string;
                fullText?: string;
                message?: string;
              };

              if (payload.type === 'chunk' && payload.text) {
                assembledText += payload.text;
                setMessages((prev) =>
                  prev.map((m) => (m.id === assistantMsgId ? { ...m, text: assembledText } : m))
                );
              } else if (payload.type === 'done') {
                if (payload.fullText && payload.fullText.length >= assembledText.length) {
                  assembledText = payload.fullText;
                  setMessages((prev) =>
                    prev.map((m) => (m.id === assistantMsgId ? { ...m, text: assembledText } : m))
                  );
                }
              } else if (payload.type === 'error') {
                throw new Error(payload.message || '英语老师生成失败');
              }
            } catch (parseErr) {
              if (parseErr instanceof Error && parseErr.message !== 'Unexpected end of JSON input') {
                if (rawEvent.includes('"type":"error"')) {
                  throw parseErr;
                }
              }
            }
          }

          if (done) break;
        }

        if (!assembledText.trim()) {
          throw new Error('英语老师暂未返回有效内容，请再次点击「翻译学习」重试。');
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          // Stopped manually or superseded
        } else {
          const errMsg =
            err instanceof Error ? err.message : '英语老师暂时无法响应，请稍后重试。';
          setChatError(errMsg);
          if (!assembledText) {
            setMessages((prev) => prev.filter((m) => m.id !== assistantMsgId));
          }
        }
      } finally {
        if (chatAbortRef.current === controller) {
          chatAbortRef.current = null;
        }
        setIsStreaming(false);

        if (assembledText.trim().length > 0) {
          // Automatically preserve every completed lesson in local Study Notebook so content is never lost
          if (onSaveCard) {
            onSaveCard({
              mode: activeMode,
              prompt: trimmed,
              content: assembledText,
              sectionTitleZh,
              silent: true,
            });
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantMsgId ? { ...m, savedToNotebook: true } : m
              )
            );
          }

          // Non-blocking background upload of lossless .md file to Google Drive
          if (autoSaveEnabled && getDriveAccessToken()) {
            void saveMessageToDriveInBackground({
              messageId: assistantMsgId,
              msgMode: activeMode,
              userPrompt: trimmed,
              markdownContent: assembledText,
            });
          }
        }
      }
    },
    [
      input,
      isStreaming,
      mode,
      vocabTemplate,
      articleTemplate,
      sectionTitleZh,
      sectionTitleEn,
      autoSaveEnabled,
      onSaveCard,
      saveMessageToDriveInBackground,
    ]
  );

  // Triggered when the user clicks "翻译学习" from text selection or paragraph hover
  useEffect(() => {
    if (!launchRequest || !launchRequest.text.trim()) return;
    if (lastHandledLaunchIdRef.current === launchRequest.id) return;
    lastHandledLaunchIdRef.current = launchRequest.id;
    const targetMode = launchRequest.mode ?? inferTeacherModeFromText(launchRequest.text);
    void handleSendMessage(launchRequest.text, targetMode);
  }, [launchRequest, handleSendMessage]);

  const handleStopStream = () => {
    chatAbortRef.current?.abort();
    setIsStreaming(false);
  };

  const handleClearChat = () => {
    chatAbortRef.current?.abort();
    setIsStreaming(false);
    setChatError(null);
    setMessages([]);
    setScrollAnchorTurnId(null);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSendMessage();
    }
  };

  const activeTemplate =
    mode === 'vocab' ? vocabTemplate : mode === 'article' ? articleTemplate : null;

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => onToggleOpen(true)}
        aria-label="展开英语老师边栏"
        data-testid="open-teacher-panel-btn"
        className="fixed right-0 top-1/2 z-30 flex -translate-y-1/2 flex-col items-center gap-1.5 rounded-l-lg border border-r-0 border-stone-200 bg-[#FBF9F5]/95 px-2.5 py-3.5 text-xs font-semibold text-[#78350F] shadow-sm backdrop-blur-sm transition-colors hover:bg-[#F3EFE6] dark:border-zinc-800 dark:bg-[#0B0C0E]/95 dark:text-amber-400 dark:hover:bg-zinc-900 cursor-pointer"
      >
        <GraduationCap className="h-4 w-4" />
        <span className="[writing-mode:vertical-rl] tracking-widest">翻译学习</span>
      </button>
    );
  }

  const panelBody = (
    <div className="flex h-full flex-col bg-[#FBF9F5] text-stone-900 dark:bg-[#0B0C0E] dark:text-[#E7E5E4]">
      {/* Minimal Header seamlessly blended with canvas */}
      <div className="flex items-center justify-between gap-2 border-b border-stone-200/70 px-4 py-2.5 dark:border-zinc-800/80">
        <div className="flex min-w-0 items-center gap-2">
          <GraduationCap className="h-4 w-4 shrink-0 text-[#78350F] dark:text-amber-400" />
          <span className="font-editorial text-sm font-semibold text-stone-950 dark:text-stone-100 whitespace-nowrap">
            英语老师
          </span>
          <span className="font-num text-[11px] text-stone-400 dark:text-zinc-500 whitespace-nowrap">
            · 4 Hydrogen
          </span>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={handleClearChat}
            title="开启新课程对话"
            aria-label="开启新对话"
            className="inline-flex h-7 items-center gap-1 rounded px-2 text-xs text-stone-500 transition-colors hover:text-stone-950 dark:text-zinc-400 dark:hover:text-stone-100 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <MessageSquarePlus className="h-3.5 w-3.5" />
            <span>新对话</span>
          </button>
          <button
            type="button"
            onClick={() => onToggleOpen(false)}
            aria-label="收起英语老师面板"
            data-testid="close-teacher-panel-btn"
            className="flex h-7 w-7 items-center justify-center rounded text-stone-500 transition-colors hover:text-stone-950 dark:text-zinc-400 dark:hover:text-stone-100 cursor-pointer"
          >
            <PanelRightClose className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Unified Compact Mode + Drive Sync Row */}
      <div className="border-b border-stone-200/60 px-4 py-2 dark:border-zinc-800/70">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div
            role="group"
            aria-label="英语教学模式"
            className="inline-flex rounded-md bg-[#EFECE5] p-0.5 dark:bg-zinc-900"
          >
            <button
              type="button"
              onClick={() => setMode('vocab')}
              className={`rounded-[5px] px-2 py-1 text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                mode === 'vocab'
                  ? 'bg-[#FBF9F5] text-[#78350F] shadow-2xs font-semibold dark:bg-zinc-800 dark:text-amber-400'
                  : 'text-stone-600 hover:text-stone-950 dark:text-zinc-400 dark:hover:text-stone-200'
              }`}
            >
              单词短语
            </button>
            <button
              type="button"
              onClick={() => setMode('article')}
              className={`rounded-[5px] px-2 py-1 text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                mode === 'article'
                  ? 'bg-[#FBF9F5] text-[#78350F] shadow-2xs font-semibold dark:bg-zinc-800 dark:text-amber-400'
                  : 'text-stone-600 hover:text-stone-950 dark:text-zinc-400 dark:hover:text-stone-200'
              }`}
            >
              句子文章
            </button>
            <button
              type="button"
              onClick={() => setMode('explore')}
              data-testid="teacher-mode-explore"
              className={`rounded-[5px] px-2 py-1 text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                mode === 'explore'
                  ? 'bg-[#FBF9F5] text-[#78350F] shadow-2xs font-semibold dark:bg-zinc-800 dark:text-amber-400'
                  : 'text-stone-600 hover:text-stone-950 dark:text-zinc-400 dark:hover:text-stone-200'
              }`}
            >
              延伸研学
            </button>
          </div>

          {!driveConnected ? (
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={isSigningIn}
              data-testid="google-signin-btn"
              title="连接 Google 云端硬盘读取学单词/英语文章学习格式并后台自动存盘"
              className="gsi-material-button inline-flex h-7 items-center gap-1.5 rounded-md border border-stone-300/90 bg-white px-2.5 text-[11px] font-medium text-stone-800 transition-colors hover:bg-stone-50 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-stone-100 dark:hover:bg-zinc-800 whitespace-nowrap shrink-0 cursor-pointer"
            >
              {isSigningIn ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-stone-500" />
              ) : (
                <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 48 48" aria-hidden="true">
                  <path
                    fill="#EA4335"
                    d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                  />
                  <path
                    fill="#4285F4"
                    d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                  />
                  <path
                    fill="#34A853"
                    d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                  />
                </svg>
              )}
              <span>Sign in with Google</span>
            </button>
          ) : (
            <div className="flex items-center gap-1.5 text-[11px] text-[#14532D] dark:text-emerald-400">
              <Cloud className="h-3.5 w-3.5 shrink-0" />
              <span className="max-w-[96px] truncate font-medium">
                {driveUser?.displayName || driveUser?.email || '云端已连'}
              </span>
              <button
                type="button"
                onClick={() => void fetchDriveTemplates()}
                disabled={isLoadingTemplates}
                title="刷新云端硬盘范本"
                aria-label="刷新云端硬盘范本"
                className="rounded p-0.5 text-stone-400 hover:text-stone-900 dark:text-zinc-500 dark:hover:text-stone-100 cursor-pointer"
              >
                <RefreshCw className={`h-3 w-3 ${isLoadingTemplates ? 'animate-spin' : ''}`} />
              </button>
              <button
                type="button"
                onClick={() => void handleGoogleSignOut()}
                title="断开 Google 账号"
                aria-label="断开 Google 账号"
                className="rounded p-0.5 text-stone-400 hover:text-stone-900 dark:text-zinc-500 dark:hover:text-stone-100 cursor-pointer"
              >
                <LogOut className="h-3 w-3" />
              </button>
            </div>
          )}
        </div>

        {/* Quiet inline Drive status strip only when connected or auth error */}
        {driveConnected && (
          <div className="mt-1.5 flex items-center justify-between gap-2 text-[11px] text-stone-500 dark:text-zinc-400">
            <span className="truncate">
              {isLoadingTemplates
                ? '同步范本中…'
                : activeTemplate?.found
                ? `参照「${activeTemplate.name}」`
                : `默认精学格式`}
              {pendingSaveCount > 0
                ? ` · 后台存 .md(${pendingSaveCount})`
                : savedCount > 0
                ? ` · 已存 ${savedCount} 份 .md`
                : ' · 自动存 .md'}
            </span>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={() => void handleOpenGooglePicker('template')}
                disabled={isPickingDrive !== null}
                data-testid="open-picker-template-btn"
                title="使用 Google Picker 自选格式范本或保存文件夹"
                className="inline-flex items-center gap-0.5 text-[#78350F] hover:underline disabled:opacity-50 dark:text-amber-400 cursor-pointer"
              >
                {isPickingDrive === 'template' ? (
                  <Loader2 className="h-2.5 w-2.5 animate-spin" />
                ) : (
                  <FolderOpen className="h-2.5 w-2.5" />
                )}
                <span>自选范本</span>
              </button>
              {lastSavedFile?.webViewLink && (
                <a
                  href={lastSavedFile.webViewLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-0.5 text-[#78350F] hover:underline dark:text-amber-400"
                >
                  <span>查看</span>
                  <ExternalLink className="h-2.5 w-2.5" />
                </a>
              )}
              <label className="inline-flex items-center gap-1 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={autoSaveEnabled}
                  onChange={(e) => setAutoSaveEnabled(e.target.checked)}
                  className="h-3 w-3 accent-[#78350F] dark:accent-amber-500"
                />
                <span>存 .md</span>
              </label>
            </div>
          </div>
        )}

        {authError && (
          <p className="mt-1 text-[11px] text-[#9A3412] dark:text-orange-400">{authError}</p>
        )}
      </div>

      {/* Scrollable Multi-Turn Conversation Thread (Blended Editorial Flow) */}
      <div
        ref={threadContainerRef}
        data-testid="teacher-chat-thread"
        className="flex-1 space-y-5 overflow-y-auto px-4 py-4"
      >
        {messages.length === 0 ? (
          <div className="space-y-4 pt-2">
            <p className="text-xs leading-relaxed text-stone-500 dark:text-zinc-400">
              {mode === 'explore' ? (
                <>
                  切换至「延伸研学」后，可随时追问书中概念背后的<strong className="font-medium text-stone-700 dark:text-stone-200">心理学、复利数学、习惯科学与相关经典书目</strong>，并将精彩回答一键存入本地「学习笔记」。
                </>
              ) : (
                <>
                  先读左侧英文原文：遇到生词<strong className="font-medium text-stone-700 dark:text-stone-200">直接双击</strong>即可带原句语境精学，划选短语或长难句可点「翻译学习」。每次讲解会自动保留至本地笔记，并支持以无损 <code className="font-num text-[11px]">.md</code> 格式存云端或导出。
                </>
              )}
            </p>

            <div className="space-y-1.5 border-t border-stone-200/70 pt-3 dark:border-zinc-800/80">
              <p className="text-[11px] text-stone-400 dark:text-zinc-500">快速试听</p>
              <div className="flex flex-col divide-y divide-stone-200/50 dark:divide-zinc-800/60">
                {STARTER_PROMPTS[mode].map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => void handleSendMessage(item.text, mode)}
                    className="flex items-center justify-between gap-2 py-2 text-left text-xs text-stone-700 transition-colors hover:text-[#78350F] dark:text-zinc-300 dark:hover:text-amber-400 cursor-pointer"
                  >
                    <span className="truncate">{item.label}</span>
                    <Sparkles className="h-3 w-3 shrink-0 opacity-60" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          messages.map((msg, idx) => {
            if (msg.role === 'user') {
              return (
                <div
                  key={msg.id}
                  ref={(el) => {
                    if (el) turnRefs.current.set(msg.id, el);
                    else turnRefs.current.delete(msg.id);
                  }}
                  className="border-t border-stone-200/70 pt-3 first:border-t-0 first:pt-0 dark:border-zinc-800/80"
                >
                  <div className="mb-1 flex items-center gap-1.5 text-[11px] text-stone-400 dark:text-zinc-500">
                    <span>提问</span>
                    <span aria-hidden="true">·</span>
                    <span>
                      {msg.mode === 'vocab'
                        ? '单词短语'
                        : msg.mode === 'explore'
                        ? '延伸研学'
                        : '句子文章'}
                    </span>
                  </div>
                  <p className="font-editorial whitespace-pre-wrap break-words text-[14px] font-medium leading-relaxed text-stone-950 dark:text-stone-100">
                    {msg.text}
                  </p>
                </div>
              );
            }

            const prevUserMsg = [...messages.slice(0, idx)]
              .reverse()
              .find((m) => m.role === 'user');
            const isCurrentlyStreamingMsg = isStreaming && idx === messages.length - 1;
            const isLatestTurn = idx === messages.length - 1;

            return (
              <div
                key={msg.id}
                className={`pb-4 ${isLatestTurn ? 'min-h-[calc(100%-5.5rem)]' : ''}`}
              >
                {!isCurrentlyStreamingMsg && msg.text.trim().length > 0 && (
                  <div className="mb-1.5 flex flex-wrap items-center justify-end gap-3 text-[11px]">
                    <button
                      type="button"
                      data-testid="teacher-download-md-btn"
                      onClick={() =>
                        handleDownloadMarkdownNote({
                          msgMode: msg.mode,
                          userPrompt: prevUserMsg?.text || '课堂笔记',
                          markdownContent: msg.text,
                          createdAt: msg.createdAt,
                        })
                      }
                      title="下载含 YAML 元数据的无损 .md 文件，方便其他 Skill 总结复用"
                      className="inline-flex items-center gap-1 text-stone-400 transition-colors hover:text-[#78350F] dark:text-zinc-500 dark:hover:text-amber-400 cursor-pointer"
                    >
                      <Download className="h-3 w-3" />
                      <span>下载 .md</span>
                    </button>

                    {onSaveCard && (
                      <button
                        type="button"
                        data-testid="teacher-save-card-btn"
                        disabled={msg.savedToNotebook}
                        onClick={() => {
                          onSaveCard({
                            mode: msg.mode,
                            prompt: prevUserMsg?.text || '课堂笔记',
                            content: msg.text,
                            sectionTitleZh,
                          });
                          setMessages((prev) =>
                            prev.map((m) =>
                              m.id === msg.id ? { ...m, savedToNotebook: true } : m
                            )
                          );
                        }}
                        className={`inline-flex items-center gap-1 transition-colors cursor-pointer ${
                          msg.savedToNotebook
                            ? 'text-[#14532D] dark:text-emerald-400 cursor-default'
                            : 'text-stone-400 hover:text-[#78350F] dark:text-zinc-500 dark:hover:text-amber-400'
                        }`}
                      >
                        {msg.savedToNotebook ? (
                          <>
                            <Check className="h-3 w-3" />
                            <span>已存笔记</span>
                          </>
                        ) : (
                          <>
                            <Bookmark className="h-3 w-3" />
                            <span>存入笔记</span>
                          </>
                        )}
                      </button>
                    )}

                    {driveConnected && (
                      <>
                        {msg.driveSaveState === 'saving' && (
                          <span className="inline-flex items-center gap-1 text-stone-400 dark:text-zinc-500">
                            <Loader2 className="h-3 w-3 animate-spin" />
                            <span>后台存 .md…</span>
                          </span>
                        )}
                        {msg.driveSaveState === 'saved' && (
                          <span className="inline-flex items-center gap-1 text-[#14532D] dark:text-emerald-400">
                            <Check className="h-3 w-3" />
                            {msg.driveWebViewLink ? (
                              <a
                                href={msg.driveWebViewLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="hover:underline"
                              >
                                已存 .md 云端
                              </a>
                            ) : (
                              <span>已存 .md 云端</span>
                            )}
                          </span>
                        )}
                        {msg.driveSaveState === 'error' && (
                          <button
                            type="button"
                            onClick={() =>
                              void saveMessageToDriveInBackground({
                                messageId: msg.id,
                                msgMode: msg.mode,
                                userPrompt: prevUserMsg?.text || '课堂笔记',
                                markdownContent: msg.text,
                              })
                            }
                            title={msg.driveError}
                            className="text-[#9A3412] hover:underline dark:text-orange-400 cursor-pointer"
                          >
                            重试存 .md
                          </button>
                        )}
                        {msg.driveSaveState === 'idle' && (
                          <button
                            type="button"
                            onClick={() =>
                              void saveMessageToDriveInBackground({
                                messageId: msg.id,
                                msgMode: msg.mode,
                                userPrompt: prevUserMsg?.text || '课堂笔记',
                                markdownContent: msg.text,
                              })
                            }
                            className="text-stone-400 hover:text-[#78350F] dark:text-zinc-500 dark:hover:text-amber-400 cursor-pointer"
                          >
                            存 .md 到云端
                          </button>
                        )}
                      </>
                    )}
                  </div>
                )}

                {msg.text ? (
                  renderTeacherMarkdown(msg.text)
                ) : (
                  <div className="flex items-center gap-2 py-1 text-xs text-stone-500 dark:text-zinc-400">
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-[#78350F] dark:text-amber-400" />
                    <span>正在精译与备课……</span>
                  </div>
                )}
              </div>
            );
          })
        )}

        {chatError && (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-md border border-[#9A3412]/30 bg-[#9A3412]/5 p-2.5 text-xs text-[#9A3412] dark:border-orange-500/40 dark:bg-orange-950/30 dark:text-orange-300"
          >
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>{chatError}</span>
          </div>
        )}
      </div>

      {/* Streamlined Composer blended into right column */}
      <div className="border-t border-stone-200/70 px-4 py-3 dark:border-zinc-800/80">
        {pickedMaterial && (
          <div
            data-testid="picked-drive-material-card"
            className="mb-2.5 rounded-md border border-stone-200/90 bg-[#F3EFE6]/70 px-3 py-2 text-xs dark:border-zinc-800 dark:bg-zinc-900/80"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-1.5">
                <FileText className="h-3.5 w-3.5 shrink-0 text-[#78350F] dark:text-amber-400" />
                <span className="truncate font-medium text-stone-900 dark:text-stone-100">
                  {pickedMaterial.name}
                </span>
                <span className="font-num shrink-0 text-[11px] text-stone-500 dark:text-zinc-400">
                  · {pickedMaterial.originalLength.toLocaleString()} 字
                </span>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                {pickedMaterial.webViewLink && (
                  <a
                    href={pickedMaterial.webViewLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="在 Google 云端硬盘中打开"
                    className="text-stone-400 hover:text-[#78350F] dark:text-zinc-500 dark:hover:text-amber-400"
                  >
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => setPickedMaterial(null)}
                  aria-label="移除已选云端文档"
                  className="text-stone-400 hover:text-stone-900 dark:text-zinc-500 dark:hover:text-stone-100 cursor-pointer"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  const docText = pickedMaterial.content;
                  setPickedMaterial(null);
                  void handleSendMessage(docText, 'article');
                }}
                className="inline-flex items-center gap-1 rounded border border-[#78350F]/40 bg-[#FBF9F5] px-2 py-1 text-[11px] font-medium text-[#78350F] transition-colors hover:bg-[#78350F] hover:text-[#FBF9F5] dark:border-amber-500/40 dark:bg-zinc-950 dark:text-amber-400 dark:hover:bg-amber-600 dark:hover:text-stone-950 cursor-pointer"
              >
                <Sparkles className="h-3 w-3" />
                <span>翻译精读</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  const docName = pickedMaterial.name;
                  const docText = pickedMaterial.content;
                  setPickedMaterial(null);
                  void handleSendMessage(
                    `请结合《微小的优势》的核心思想，帮我研读并延伸解析这篇来自我 Google 云端硬盘的文档《${docName}》：\n\n${docText}`,
                    'explore'
                  );
                }}
                className="inline-flex items-center gap-1 rounded border border-stone-300 px-2 py-1 text-[11px] font-medium text-stone-700 transition-colors hover:border-[#78350F] hover:text-[#78350F] dark:border-zinc-700 dark:text-zinc-300 dark:hover:border-amber-400 dark:hover:text-amber-400 cursor-pointer"
              >
                <span>结合本书延伸</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  const key = mode === 'vocab' ? 'vocab' : 'article';
                  const tpl: DriveTemplateInfo = {
                    key,
                    targetName: pickedMaterial.name,
                    found: true,
                    fileId: pickedMaterial.id,
                    name: pickedMaterial.name,
                    mimeType: pickedMaterial.mimeType,
                    isFolder: false,
                    folderId: pickedMaterial.folderId,
                    webViewLink: pickedMaterial.webViewLink,
                    sampleContent: pickedMaterial.content,
                  };
                  if (key === 'vocab') setVocabTemplate(tpl);
                  else setArticleTemplate(tpl);
                  setPickedMaterial(null);
                }}
                className="inline-flex items-center gap-1 text-[11px] text-stone-500 hover:text-[#78350F] dark:text-zinc-400 dark:hover:text-amber-400 cursor-pointer"
              >
                <span>设为当前范本</span>
              </button>
            </div>
          </div>
        )}

        <div className="flex flex-col gap-2">
          <textarea
            ref={textareaRef}
            rows={2}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              mode === 'vocab'
                ? '输入单词/短语，或继续向老师追问…（Enter 发送）'
                : mode === 'explore'
                ? '追问书内观点背后的心理学、复利原理或相关书籍…（Enter 发送）'
                : '粘贴英语句子/段落，或追问句法…（Enter 发送）'
            }
            aria-label="向英语老师提问输入框"
            className="min-h-[56px] max-h-32 w-full resize-y rounded-md border border-stone-300/80 bg-transparent px-3 py-2 text-[13px] leading-relaxed text-stone-900 placeholder:text-stone-400 focus:border-[#78350F] focus:outline-none dark:border-zinc-800 dark:text-stone-100 dark:placeholder:text-zinc-500 dark:focus:border-amber-500"
          />

          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => void handleOpenGooglePicker('material')}
              disabled={isPickingDrive !== null || isSigningIn}
              data-testid="open-picker-material-btn"
              title="通过 Google Picker 从云端硬盘挑选文档导入学习或设为范本"
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-stone-300/90 px-2.5 text-xs font-medium text-stone-700 transition-colors hover:border-[#78350F] hover:text-[#78350F] disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:border-amber-400 dark:hover:text-amber-400 whitespace-nowrap shrink-0 cursor-pointer"
            >
              {isPickingDrive === 'material' ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <FolderOpen className="h-3.5 w-3.5" />
              )}
              <span>云端选材</span>
            </button>

            {isStreaming ? (
              <button
                type="button"
                onClick={handleStopStream}
                aria-label="停止生成"
                className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[#78350F] px-3 text-xs font-medium text-[#78350F] transition-colors hover:bg-[#F3EFE6] dark:border-amber-500 dark:text-amber-400 dark:hover:bg-zinc-900 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Square className="h-3 w-3 fill-current" />
                <span>停止</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void handleSendMessage()}
                aria-label={mode === 'explore' ? '延伸精讲' : '翻译学习'}
                data-testid="teacher-send-btn"
                className="inline-flex h-8 items-center gap-1.5 rounded-md bg-[#78350F] px-3.5 text-xs font-medium text-[#FBF9F5] transition-colors hover:bg-[#5C280B] dark:bg-amber-600 dark:text-stone-950 dark:font-semibold dark:hover:bg-amber-500 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span>{mode === 'explore' ? '延伸精讲' : '翻译学习'}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile / Tablet Backdrop Scrim (< xl) */}
      <div
        aria-hidden="true"
        className="fixed inset-0 z-40 bg-stone-950/35 backdrop-blur-xs dark:bg-black/70 xl:hidden"
        onClick={() => onToggleOpen(false)}
      />

      {/* Single Responsive Side Panel (Overlay Drawer < xl, Seamless Right Margin Column xl+) */}
      <aside
        aria-label="英语老师侧边栏"
        data-testid="english-teacher-panel"
        className={`fixed top-0 bottom-0 right-0 z-50 h-full w-full max-w-[410px] shrink-0 border-l border-stone-200/70 shadow-2xl transition-[top,height] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] dark:border-zinc-800/80 xl:sticky xl:bottom-auto xl:z-20 xl:w-[390px] xl:max-w-none xl:shadow-none 2xl:w-[420px] ${
          fullHeight ? 'xl:top-0 xl:h-screen' : 'xl:top-[65px] xl:h-[calc(100vh-65px)]'
        }`}
      >
        {panelBody}
      </aside>
    </>
  );
}
