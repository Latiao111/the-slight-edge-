import {
  normalizePickedDocument,
  resolvePickerOrigin,
  type PickedDriveItem,
} from '../utils/pickerHelpers';

interface GooglePickerDocsView {
  setIncludeFolders: (include: boolean) => GooglePickerDocsView;
  setSelectFolderEnabled: (enabled: boolean) => GooglePickerDocsView;
  setMimeTypes?: (mimeTypes: string) => GooglePickerDocsView;
}

interface GooglePickerInstance {
  setVisible: (visible: boolean) => void;
}

interface GooglePickerBuilder {
  addView: (view: unknown) => GooglePickerBuilder;
  setOAuthToken: (token: string) => GooglePickerBuilder;
  setCallback: (cb: (data: { action?: string; docs?: Record<string, unknown>[] }) => void) => GooglePickerBuilder;
  setOrigin: (origin: string) => GooglePickerBuilder;
  setTitle?: (title: string) => GooglePickerBuilder;
  setLocale?: (locale: string) => GooglePickerBuilder;
  build: () => GooglePickerInstance;
}

interface GooglePickerNamespace {
  PickerBuilder: new () => GooglePickerBuilder;
  DocsView: new (viewId?: unknown) => GooglePickerDocsView;
  ViewId: {
    DOCS: unknown;
    FOLDERS: unknown;
  };
  Action: {
    PICKED: string;
    CANCEL: string;
  };
}

declare global {
  interface Window {
    gapi?: {
      load: (
        api: string,
        options: { callback: () => void; onerror?: () => void } | (() => void)
      ) => void;
    };
    google?: {
      picker?: GooglePickerNamespace;
    };
  }
}

let pickerLoadPromise: Promise<GooglePickerNamespace> | null = null;

function ensureGoogleApiScript(): Promise<void> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Google Picker 仅支持在浏览器环境中使用。'));
  }
  if (window.gapi) return Promise.resolve();

  return new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      'script[src="https://apis.google.com/js/api.js"]'
    );
    if (existing) {
      if (window.gapi) {
        resolve();
        return;
      }
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener(
        'error',
        () => reject(new Error('无法加载 Google Picker 脚本，请检查网络连接。')),
        { once: true }
      );
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://apis.google.com/js/api.js';
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('无法加载 Google Picker 脚本，请检查网络连接。'));
    document.head.appendChild(script);
  });
}

export function loadGooglePicker(): Promise<GooglePickerNamespace> {
  if (typeof window !== 'undefined' && window.google?.picker) {
    return Promise.resolve(window.google.picker);
  }
  if (pickerLoadPromise) return pickerLoadPromise;

  pickerLoadPromise = ensureGoogleApiScript()
    .then(
      () =>
        new Promise<GooglePickerNamespace>((resolve, reject) => {
          if (!window.gapi) {
            reject(new Error('Google API 客户端未能初始化。'));
            return;
          }
          window.gapi.load('picker', {
            callback: () => {
              if (window.google?.picker) {
                resolve(window.google.picker);
              } else {
                reject(new Error('Google Picker 组件未能就绪，请稍后重试。'));
              }
            },
            onerror: () => {
              reject(new Error('加载 Google Picker 模块失败，请重试。'));
            },
          });
        })
    )
    .catch((err) => {
      pickerLoadPromise = null;
      throw err;
    });

  return pickerLoadPromise;
}

export type PickerPurpose = 'material' | 'template';

/**
 * Opens the native Google Picker widget using the user's OAuth access token.
 * Deliberately omits developerKey per Google Workspace Picker integration guide.
 */
export async function openGoogleDrivePicker(params: {
  accessToken: string;
  purpose: PickerPurpose;
}): Promise<PickedDriveItem | null> {
  const { accessToken, purpose } = params;
  const pickerApi = await loadGooglePicker();

  const pickerOrigin = resolvePickerOrigin(
    window.location.ancestorOrigins,
    window.location.origin
  );

  return new Promise<PickedDriveItem | null>((resolve) => {
    const builder = new pickerApi.PickerBuilder();

    if (purpose === 'template') {
      const docsAndFoldersView = new pickerApi.DocsView(pickerApi.ViewId.DOCS)
        .setIncludeFolders(true)
        .setSelectFolderEnabled(true);
      builder.addView(docsAndFoldersView);
      builder.setTitle?.('选择学习格式范本或保存文件夹');
    } else {
      const docsView = new pickerApi.DocsView(pickerApi.ViewId.DOCS)
        .setIncludeFolders(true)
        .setSelectFolderEnabled(false);
      builder.addView(docsView);
      builder.setTitle?.('从 Google 云端硬盘选择英语学习文档');
    }

    builder
      .setOAuthToken(accessToken)
      .setOrigin(pickerOrigin)
      .setLocale?.('zh-CN');

    builder.setCallback((data) => {
      if (data.action === pickerApi.Action.PICKED) {
        const picked = normalizePickedDocument(data.docs?.[0]);
        resolve(picked);
      } else if (data.action === pickerApi.Action.CANCEL) {
        resolve(null);
      }
    });

    const picker = builder.build();
    picker.setVisible(true);
  });
}
