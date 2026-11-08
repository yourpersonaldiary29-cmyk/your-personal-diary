/**
 * ja - emotions messages. Keys are prefixed 'emotions.'; see shared/i18n/index.ts for the syntax.
 *
 * 'emotions.<key>.label'   - the label shown in the UI (emotion picker, badges, exports).
 * 'emotions.<key>.aliases' - comma-separated words the search parser also resolves to the
 *                            key (kanji/kana spellings, past forms, nouns, synonyms).
 */
const messages: Record<string, string> = {
  'emotions.happy.label': 'うれしい',
  'emotions.happy.aliases': '嬉しい,うれしかった,嬉しかった,幸せ,しあわせ,楽しい,楽しかった,喜び,ハッピー',
  'emotions.calm.label': '穏やか',
  'emotions.calm.aliases': 'おだやか,落ち着いた,落ち着き,リラックス,平穏,安らぎ,のんびり',
  'emotions.sad.label': '悲しい',
  'emotions.sad.aliases': 'かなしい,悲しかった,悲しみ,落ち込んだ,落ち込み,憂うつ,つらい',
  'emotions.angry.label': '怒り',
  'emotions.angry.aliases': '怒った,怒っていた,腹が立った,腹立たしい,むかついた,いらだち',
  'emotions.stressed.label': 'ストレス',
  'emotions.stressed.aliases': 'ストレスを感じた,ストレスがたまった,プレッシャー,張り詰めた,ピリピリ',
  'emotions.excited.label': 'ワクワク',
  'emotions.excited.aliases': 'わくわく,興奮,ドキドキ,胸が高鳴る',
  'emotions.tired.label': '疲れた',
  'emotions.tired.aliases': '疲れ,疲れていた,疲労,くたくた,へとへと,眠い,だるい',
  'emotions.satisfied.label': '満足',
  'emotions.satisfied.aliases': '満たされた,充実,充実感,満足感',
  'emotions.frustrated.label': 'もどかしい',
  'emotions.frustrated.aliases': 'もどかしかった,フラストレーション,歯がゆい,悔しい,イライラ',
  'emotions.anxious.label': '不安',
  'emotions.anxious.aliases': '心配,不安だった,気がかり,緊張,怖い',
  'emotions.energetic.label': '元気いっぱい',
  'emotions.energetic.aliases': '元気,エネルギッシュ,活力,活気,はつらつ',
  'emotions.grateful.label': '感謝',
  'emotions.grateful.aliases': 'ありがたい,感謝の気持ち,ありがとう',
  'emotions.lonely.label': 'さみしい',
  'emotions.lonely.aliases': '寂しい,さびしい,寂しかった,孤独,ひとりぼっち',
  'emotions.hopeful.label': '希望に満ちた',
  'emotions.hopeful.aliases': '希望,前向き,楽観的,期待',
  'emotions.bored.label': '退屈',
  'emotions.bored.aliases': 'つまらない,暇,飽きた',
  'emotions.proud.label': '誇らしい',
  'emotions.proud.aliases': '誇り,自慢,誇らしかった',
  'emotions.focused.label': '集中',
  'emotions.focused.aliases': '集中できた,集中力,没頭',
  'emotions.overwhelmed.label': 'いっぱいいっぱい',
  'emotions.overwhelmed.aliases': '圧倒された,手一杯,キャパオーバー,押しつぶされそう',
};
export default messages;
