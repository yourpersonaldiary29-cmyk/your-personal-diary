/**
 * zh - emotions messages. Keys are prefixed 'emotions.'; see shared/i18n/index.ts for the syntax.
 *
 * 'emotions.<key>.label'   - the label shown in the UI (emotion picker, badges, exports).
 * 'emotions.<key>.aliases' - comma-separated words the search parser also resolves to the
 *                            key (synonyms, colloquial forms, nouns).
 */
const messages: Record<string, string> = {
  'emotions.happy.label': '开心',
  'emotions.happy.aliases': '快乐,高兴,幸福,愉快,喜悦,开心的',
  'emotions.calm.label': '平静',
  'emotions.calm.aliases': '放松,宁静,安宁,淡定,安心,心平气和',
  'emotions.sad.label': '难过',
  'emotions.sad.aliases': '伤心,悲伤,难受,忧郁,失落,不开心',
  'emotions.angry.label': '生气',
  'emotions.angry.aliases': '愤怒,气愤,恼火,发火,烦躁',
  'emotions.stressed.label': '压力大',
  'emotions.stressed.aliases': '紧张,有压力,压力很大,焦头烂额',
  'emotions.excited.label': '兴奋',
  'emotions.excited.aliases': '激动,期待,兴致勃勃',
  'emotions.tired.label': '疲惫',
  'emotions.tired.aliases': '累,疲劳,疲倦,困倦,犯困,精疲力尽,累坏了',
  'emotions.satisfied.label': '满足',
  'emotions.satisfied.aliases': '满意,知足,欣慰',
  'emotions.frustrated.label': '沮丧',
  'emotions.frustrated.aliases': '挫败,受挫,挫败感,懊恼',
  'emotions.anxious.label': '焦虑',
  'emotions.anxious.aliases': '担心,担忧,不安,忐忑,害怕',
  'emotions.energetic.label': '精力充沛',
  'emotions.energetic.aliases': '充满活力,有活力,活力满满,元气满满',
  'emotions.grateful.label': '感恩',
  'emotions.grateful.aliases': '感激,感谢,感恩的心',
  'emotions.lonely.label': '孤独',
  'emotions.lonely.aliases': '寂寞,孤单,孤零零',
  'emotions.hopeful.label': '充满希望',
  'emotions.hopeful.aliases': '希望,有希望,乐观,期望',
  'emotions.bored.label': '无聊',
  'emotions.bored.aliases': '厌倦,乏味,没意思',
  'emotions.proud.label': '自豪',
  'emotions.proud.aliases': '骄傲,自豪感',
  'emotions.focused.label': '专注',
  'emotions.focused.aliases': '专心,集中,注意力集中',
  'emotions.overwhelmed.label': '不堪重负',
  'emotions.overwhelmed.aliases': '应接不暇,喘不过气,忙不过来,招架不住',
};
export default messages;
