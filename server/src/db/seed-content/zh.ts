/** zh - demo texts ("Load sample data"). Same fields and pool sizes as en.ts (see README.md). */
import type { SeedContent } from './types';

const content: SeedContent = {
  titles: {
    high: ['美好的早晨', '精力充沛的一天', '真是不错的一天', '终于休息好了', '小有收获的一天', '阳光和新鲜空气'],
    mid: ['平常的一天', '工作日', '琐事与日常', '又过了一天', '按自己的节奏过一天', '舒心的日常'],
    low: ['艰难的一天', '累坏了', '今天过得不轻松', '筋疲力尽的一天', '脑袋昏沉沉', '只想这一天快点结束'],
  },
  openers: {
    high: ['今天感觉特别好。', '早上笑着醒来，一整天都保持着这样的好心情。', '这是活力满满的一天。', '整个人轻松又快乐。'],
    mid: ['平平常常的一天，没什么意外。', '按自己的节奏过完了这一天。', '没什么特别的，不过还不错。', '照常上班、处理琐事的一天。'],
    low: ['今天过得很艰难。', '今天大部分时间都觉得身体沉重，很累。', '做什么都集中不了注意力。', '这一天从一开始就不顺。'],
  },
  events: [
    '工作会议',
    '家庭聚餐',
    '看医生',
    '去超市买菜',
    '和老朋友通电话',
    '去银行办事',
    '一场有趣的讲座',
    '居家办公',
    '短途出游',
    '打扫屋子',
    '朋友聚会',
    '健身课',
    '晚上看电影',
    '尝试做一道新菜',
  ],
  sundayEvents: ['规划新的一周', '团队周会', '一大堆邮件要回'],
  people: ['晓雯', '志强', '妈妈', '爸爸', '海燕', '欣怡', '建华', '雨桐', '浩然', '美玲'],
  locations: ['家', '办公室', '公园', '咖啡馆', '父母家', '海边', '图书馆'],
  tags: ['工作', '家庭', '健康', '朋友', '运动', '学习', '休息', '自然', '创意', '金钱'],
  sportTag: '运动',
  // Each one reads in "上午{type} {minutes} 分钟。" (diary shorthand: "上午跑步 30 分钟。").
  exerciseTypes: ['散步', '跑步', '力量训练', '游泳', '骑行', '瑜伽'],
  badDay: {
    title: '糟糕透顶的一天',
    body: '糟糕透顶的一天。什么都不顺——起晚了，错过了一个重要的会议，还和一位好朋友吵了一架。整个人被压得喘不过气，不知道该从哪里开始。',
  },
  goodDay: {
    title: '完美的一天',
    body: '完美的一天！工作上传来了好消息，晚上和全家人一起庆祝，我对这一切都心怀感激。',
  },
  sleep: (hours, low) => (low ? `昨晚只睡了 ${hours} 个小时，白天明显感觉到了。` : `昨晚睡了 ${hours} 个小时，睡得还不错。`),
  exercise: (type, minutes, slot) => `${slot === 'midday' ? '上午' : '下午'}${type} ${minutes} 分钟。`,
  secondEntry: (slot) => (slot === 'midday' ? '趁着两件事之间的空当，中午简单写几句。' : '睡前简单总结一下今晚。'),
  sundayNote: '新的一周开始时总有点紧张——桌上堆了好多事情。',
  peopleSentence: (names, met) => (met ? `见到了${names.join('和')}。` : `跟${names.join('和')}聊了聊天。`),
  note: '记得明天写一写哪些事情进展得不错。',
  // No space between sentences in Chinese.
  sentenceSeparator: '',
};

export default content;
