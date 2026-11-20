export const PRIMARY_GEMINI_MODEL = 'gemini-4-hydrogen';
export const FALLBACK_GEMINI_MODELS: readonly string[] = [];

function tryParseJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Unwraps nested JSON error envelopes returned by @google/genai into a
 * `{ code, status, message }` tuple.
 */
export function extractGeminiErrorDetails(err: unknown): {
  code?: number;
  status?: string;
  message: string;
} {
  let code: number | undefined;
  let status: string | undefined;
  let rawMessage = '';

  if (err && typeof err === 'object') {
    const anyErr = err as {
      status?: unknown;
      code?: unknown;
      message?: unknown;
      error?: unknown;
    };
    if (typeof anyErr.status === 'number') code = anyErr.status;
    else if (typeof anyErr.code === 'number') code = anyErr.code;
    if (typeof anyErr.status === 'string') status = anyErr.status;
    if (typeof anyErr.message === 'string') rawMessage = anyErr.message;
    else if (anyErr.error && typeof anyErr.error === 'object') {
      rawMessage = JSON.stringify(anyErr.error);
    }
  } else if (typeof err === 'string') {
    rawMessage = err;
  }

  let current = rawMessage.trim();
  for (let depth = 0; depth < 4; depth++) {
    if (!current.startsWith('{')) break;
    const parsed = tryParseJson(current);
    if (!parsed || typeof parsed !== 'object') break;

    const envelope =
      (parsed as { error?: unknown }).error && typeof (parsed as { error?: unknown }).error === 'object'
        ? ((parsed as { error: Record<string, unknown> }).error)
        : (parsed as Record<string, unknown>);

    if (typeof envelope.code === 'number') code = envelope.code;
    if (typeof envelope.status === 'string') status = envelope.status;
    if (typeof envelope.message === 'string' && envelope.message.trim()) {
      current = envelope.message.trim();
    } else {
      break;
    }
  }

  return {
    code,
    status,
    message: current || rawMessage || '未知服务错误',
  };
}

export function isTransientGeminiError(err: unknown): boolean {
  if (err instanceof DOMException && err.name === 'AbortError') {
    return false;
  }

  const { code, status, message } = extractGeminiErrorDetails(err);
  if (code && [408, 429, 500, 502, 503, 504].includes(code)) {
    return true;
  }

  const combined = `${status ?? ''} ${message}`.toLowerCase();
  if (
    combined.includes('api_key_invalid') ||
    combined.includes('permission_denied') ||
    combined.includes('api key not valid')
  ) {
    return false;
  }

  return (
    combined.includes('unavailable') ||
    combined.includes('high demand') ||
    combined.includes('overloaded') ||
    combined.includes('resource_exhausted') ||
    combined.includes('deadline_exceeded') ||
    combined.includes('service unavailable') ||
    combined.includes('try again later') ||
    combined.includes('rate limit') ||
    combined.includes('temporarily') ||
    combined.includes('timeout') ||
    combined.includes('timed out') ||
    combined.includes('econnreset') ||
    combined.includes('etimedout') ||
    combined.includes('eai_again') ||
    combined.includes('fetch failed') ||
    combined.includes('network')
  );
}

export function formatGeminiErrorMessage(
  err: unknown,
  context: 'translate' | 'teacher'
): string {
  const { code, status, message } = extractGeminiErrorDetails(err);
  const combined = `${status ?? ''} ${message}`.toLowerCase();

  if (
    code === 403 ||
    combined.includes('permission_denied') ||
    combined.includes('api_key_invalid') ||
    combined.includes('api key not valid')
  ) {
    return 'Gemini API 密钥无效或权限不足，请在 Settings > Secrets 中检查 GEMINI_API_KEY 配置。';
  }

  if (code === 429 || combined.includes('resource_exhausted') || combined.includes('quota')) {
    return '当前 Gemini API 调用配额或并发已达上限，请稍候片刻后重试。';
  }

  if (
    code === 503 ||
    code === 502 ||
    code === 504 ||
    combined.includes('unavailable') ||
    combined.includes('high demand') ||
    combined.includes('overloaded')
  ) {
    return context === 'translate'
      ? '当前翻译模型访问量激增、暂时繁忙，已保留已译段落，请稍候几秒后再次点击继续翻译。'
      : '英语老师模型当前访问量激增、暂时繁忙，请稍候几秒后再点击「翻译学习」重试。';
  }

  if (combined.includes('timeout') || combined.includes('timed out')) {
    return context === 'translate'
      ? '翻译连接响应超时，请稍后重试。'
      : '英语老师响应超时，请稍后重试。';
  }

  if (code === 404 || combined.includes('not_found')) {
    return '所请求的 Gemini 模型当前不可用，请刷新页面后重试。';
  }

  return message.length > 220 ? `${message.slice(0, 220)}…` : message;
}

export interface RetryAttemptContext {
  model: string;
  attempt: number;
  isFallback: boolean;
}

export async function runWithGeminiRetryAndFallback<T>(params: {
  primaryModel?: string;
  fallbackModels?: readonly string[];
  primaryAttempts?: number;
  fallbackAttempts?: number;
  baseDelayMs?: number;
  shouldCancel?: () => boolean;
  onRetryWait?: (ctx: RetryAttemptContext & { delayMs: number; error: unknown }) => void;
  sleep?: (ms: number) => Promise<void>;
  execute: (ctx: RetryAttemptContext) => Promise<T>;
}): Promise<T> {
  const primaryModel = params.primaryModel ?? PRIMARY_GEMINI_MODEL;
  const fallbackModels = params.fallbackModels ?? FALLBACK_GEMINI_MODELS;
  const primaryAttempts = params.primaryAttempts ?? 3;
  const fallbackAttempts = params.fallbackAttempts ?? 2;
  const baseDelayMs = params.baseDelayMs ?? 1000;
  const sleepFn =
    params.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));

  const plan: RetryAttemptContext[] = [];
  for (let i = 1; i <= primaryAttempts; i++) {
    plan.push({ model: primaryModel, attempt: i, isFallback: false });
  }

  const seenModels = new Set<string>([primaryModel]);
  for (const fallbackModel of fallbackModels) {
    if (!fallbackModel || seenModels.has(fallbackModel)) continue;
    seenModels.add(fallbackModel);
    for (let i = 1; i <= fallbackAttempts; i++) {
      plan.push({ model: fallbackModel, attempt: i, isFallback: true });
    }
  }

  let lastError: unknown;
  for (let idx = 0; idx < plan.length; idx++) {
    if (params.shouldCancel?.()) {
      throw lastError ?? new Error('请求已取消');
    }

    const ctx = plan[idx];
    try {
      return await params.execute(ctx);
    } catch (err) {
      lastError = err;
      const hasNext = idx < plan.length - 1;
      if (!hasNext || !isTransientGeminiError(err) || params.shouldCancel?.()) {
        throw err;
      }

      const delayMs = ctx.isFallback ? baseDelayMs : Math.round(baseDelayMs * Math.pow(1.6, idx));
      params.onRetryWait?.({ ...ctx, delayMs, error: err });
      await sleepFn(delayMs);
    }
  }

  throw lastError;
}
