export default {
  tools: {
    title: 'ツール',
    pen: {
      title: 'ペン',
      size: 'ペンサイズ',
    },
    eraser: {
      title: '消しゴム',
      size: '消しゴムサイズ',
    },
    avatar: {
      title: 'アバター',
      size: 'アバターサイズ',
      borderSize: '枠線サイズ',
      select: 'アバター画像を選択',
      remove: 'アバターを削除',
      change: '変更',
      removeShort: '削除',
      dragHint: 'キャンバス上のアバターをドラッグして移動できます',
    },
    color: {
      title: 'テーマ色',
      color: 'テーマ色',
    },
    name: {
      title: '名前',
      placeholder: '名前を入力してください',
    },
  },
  actions: {
    title: '操作',
    undo: '元に戻す',
    redo: 'やり直し',
    clear: 'クリア',
    clearConfirm: {
      title: '描画をクリアしますか？',
      message: '手描きの内容がすべて消去されます。元に戻すで復元できます。',
      ok: 'クリア',
      cancel: 'キャンセル',
    },
    download: 'ダウンロード',
    // 空間有限時使用的短標籤
    downloadShort: '保存',
    downloadLayer: 'レイヤ分けダウンロード',
    reset: '最初からやり直す',
    resetConfirm: {
      title: '最初からやり直しますか？',
      message: '現在の作品を消去して初期状態に戻します。この操作は元に戻せません。',
      ok: 'やり直す',
      cancel: 'キャンセル',
    },
  },
  settings: {
    title: '設定',
    i18n: {
      title: '言語',
      options: {
        'en-US': 'English',
        'zh-TW': '繁體中文',
        'ja-JP': '日本語',
      },
    },
  },
  dialog: {
    crop: {
      title: 'アバターの切り抜き',
      confirm: '切り抜き',
      cancel: 'キャンセル',
    },
  },
  pwa: {
    update: '新しいバージョンが利用可能です！ 再読み込みで更新します',
    refresh: '再読み込みします',
    dismiss: '無視する',
  },
}
