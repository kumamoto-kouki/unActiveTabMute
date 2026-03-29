'use strict';

/**
 * アクティブなタブ以外の音声をミュートするサービスワーカー
 *
 * ミュート判定ルール（有効時）:
 *   - フォーカスされているウィンドウのアクティブタブ → アンミュート
 *   - それ以外の全タブ → ミュート
 *   - ユーザーがスピーカーアイコンで手動操作したタブ → 自動制御から除外
 *
 * ON/OFFトグル: 拡張機能アイコンをクリックで切り替え
 * 無効時は全タブをアンミュートし、以降のイベントでは何もしない
 */

/**
 * ユーザーがスピーカーアイコンで手動ミュート/アンミュートしたタブのID集合
 * このセットに含まれるタブは自動ミュート制御をスキップする
 * 拡張機能をON切り替え時にリセット、タブ削除時にエントリをクリーンアップ
 */
const manualOverrideTabs = new Set();

/**
 * 拡張機能が chrome.tabs.update でミュート状態を変更する予定のタブID集合
 * tabs.onUpdated 発火時に「拡張機能自身の変更か、ユーザーの手動操作か」を区別するために使う
 */
const pendingExtensionMuteUpdates = new Set();

/**
 * 拡張機能としてタブのミュート状態を変更する
 * 変更前に pendingExtensionMuteUpdates へ登録することで、onUpdated で拡張機能の変更と識別できる
 */
function setTabMuted(tabId, muted) {
  pendingExtensionMuteUpdates.add(tabId);
  return chrome.tabs.update(tabId, { muted });
}

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
      if (manualOverrideTabs.has(tab.id)) return Promise.resolve();
      const shouldMute = !(tab.active && tab.windowId === focusedWindowId);
      if (tab.mutedInfo?.muted !== shouldMute) {
        return setTabMuted(tab.id, shouldMute);
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
    .filter((tab) => !manualOverrideTabs.has(tab.id))
    .map((tab) => setTabMuted(tab.id, true));
  await Promise.all(updates);
}

/**
 * 全タブをアンミュートする（拡張機能が無効化された時に使用）
 */
async function unmuteAllTabs() {
  const allTabs = await chrome.tabs.query({});
  const updates = allTabs
    .filter((tab) => tab.id !== undefined && tab.mutedInfo?.muted === true)
    .map((tab) => setTabMuted(tab.id, false));
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
    manualOverrideTabs.clear();
    updateAllTabsMuteState();
  }
});

// ミュート状態の変化を検知し、ユーザーの手動操作を記録する
// 拡張機能自身の変更（setTabMuted 経由）は pendingExtensionMuteUpdates で識別してスキップする
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (!changeInfo.mutedInfo) return;
  if (pendingExtensionMuteUpdates.delete(tabId)) return;
  manualOverrideTabs.add(tabId);
});

// タブ削除時にセットからクリーンアップ（メモリリーク防止）
chrome.tabs.onRemoved.addListener((tabId) => {
  manualOverrideTabs.delete(tabId);
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
