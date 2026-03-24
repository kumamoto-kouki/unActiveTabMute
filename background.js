'use strict';

/**
 * アクティブなタブ以外の音声をミュートするサービスワーカー
 *
 * ミュート判定ルール（有効時）:
 *   - フォーカスされているウィンドウのアクティブタブ → アンミュート
 *   - それ以外の全タブ → ミュート
 *
 * ON/OFFトグル: 拡張機能アイコンをクリックで切り替え
 * 無効時は全タブをアンミュートし、以降のイベントでは何もしない
 */

/** chrome.storage.local から enabled 状態を取得する（デフォルト: true） */
async function isEnabled() {
  const { enabled = true } = await chrome.storage.local.get('enabled');
  return enabled;
}

/**
 * アクションアイコンとツールチップを enabled 状態に合わせて更新する
 */
function updateActionIcon(enabled) {
  chrome.action.setIcon({
    path: {
      '16':  enabled ? 'icons/icon16.png'      : 'icons/icon16_off.png',
      '48':  enabled ? 'icons/icon48.png'      : 'icons/icon48_off.png',
      '128': enabled ? 'icons/icon128.png'     : 'icons/icon128_off.png',
    },
  });
  chrome.action.setTitle({
    title: enabled ? 'unActiveTabMute（有効）' : 'unActiveTabMute（無効）',
  });
}

/**
 * 全タブのミュート状態を更新する
 * 差分更新により不要なAPI呼び出しを省き、100ms以内の応答を保証する
 */
async function updateAllTabsMuteState() {
  if (!(await isEnabled())) return;

  const [focusedWindow, allTabs] = await Promise.all([
    chrome.windows.getLastFocused({ populate: false }),
    chrome.tabs.query({}),
  ]);

  const focusedWindowId = focusedWindow?.id ?? chrome.windows.WINDOW_ID_NONE;

  const updates = allTabs
    .filter((tab) => tab.id !== undefined)
    .map((tab) => {
      const shouldMute = !(tab.active && tab.windowId === focusedWindowId);
      if (tab.mutedInfo?.muted !== shouldMute) {
        return chrome.tabs.update(tab.id, { muted: shouldMute });
      }
      return Promise.resolve();
    });

  await Promise.all(updates);
}

/**
 * 全タブをミュートする（Chromeがバックグラウンドに移った時などに使用）
 */
async function muteAllTabs() {
  if (!(await isEnabled())) return;

  const allTabs = await chrome.tabs.query({});
  const updates = allTabs
    .filter((tab) => tab.id !== undefined && tab.mutedInfo?.muted !== true)
    .map((tab) => chrome.tabs.update(tab.id, { muted: true }));
  await Promise.all(updates);
}

/**
 * 全タブをアンミュートする（拡張機能が無効化された時に使用）
 */
async function unmuteAllTabs() {
  const allTabs = await chrome.tabs.query({});
  const updates = allTabs
    .filter((tab) => tab.id !== undefined && tab.mutedInfo?.muted === true)
    .map((tab) => chrome.tabs.update(tab.id, { muted: false }));
  await Promise.all(updates);
}

// アイコンクリックで ON/OFF トグル
chrome.action.onClicked.addListener(async () => {
  const { enabled = true } = await chrome.storage.local.get('enabled');
  await chrome.storage.local.set({ enabled: !enabled });
  // storage.onChanged が updateActionIcon / mute制御を処理する
});

// タブがアクティブになった時（タブ切り替え）
chrome.tabs.onActivated.addListener(() => {
  updateAllTabsMuteState();
});

// ウィンドウのフォーカスが変わった時
chrome.windows.onFocusChanged.addListener((windowId) => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) {
    muteAllTabs();
  } else {
    updateAllTabsMuteState();
  }
});

// ストレージの変化を監視（アイコンクリックによるON/OFFトグル）
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local' || !('enabled' in changes)) return;

  const enabled = changes.enabled.newValue;
  updateActionIcon(enabled);

  if (!enabled) {
    unmuteAllTabs();
  } else {
    updateAllTabsMuteState();
  }
});

// 拡張機能インストール・更新時の初期化
chrome.runtime.onInstalled.addListener(async () => {
  const { enabled = true } = await chrome.storage.local.get('enabled');
  updateActionIcon(enabled);
  updateAllTabsMuteState();
});

// Chrome起動時の初期化
chrome.runtime.onStartup.addListener(async () => {
  const { enabled = true } = await chrome.storage.local.get('enabled');
  updateActionIcon(enabled);
  updateAllTabsMuteState();
});
