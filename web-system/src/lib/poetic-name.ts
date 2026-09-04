/**
 * poetic-name.ts — 诗意昵称随机生成
 * 意象词 + 人物字，如「烟雨客」「青衫君」「东篱翁」
 */

const IMAGES = [
  '烟雨', '青衫', '孤鸿', '轻舟', '长风', '暮雪', '晚钟', '疏影',
  '暗香', '寒江', '东篱', '白鹭', '沧浪', '长亭', '南浦', '竹坞',
  '松风', '溪云', '花间', '月下', '云外', '短笛', '残阳', '清泉',
  '远岫', '半山', '渔火', '芦花', '兰若', '鹤影', '梅边', '枕石',
];

const ROLES = ['客', '人', '君', '子', '翁', '士', '隐', '生', '仙', '童'];

export function randomPoeticName(): string {
  const a = IMAGES[Math.floor(Math.random() * IMAGES.length)];
  const b = ROLES[Math.floor(Math.random() * ROLES.length)];
  return `${a}${b}`;
}

/** 生成一个与已有昵称不重复的（简单规避：同名单则再换一次） */
export function randomPoeticNameExcluding(taken: Set<string>): string {
  for (let i = 0; i < 12; i++) {
    const n = randomPoeticName();
    if (!taken.has(n)) return n;
  }
  return `${randomPoeticName()}${Math.floor(Math.random() * 90 + 10)}`;
}
