import "server-only";
import type { Blank } from "@/lib/types";

/**
 * The stories. SERVER-ONLY: the whole game is the player not knowing this text
 * until they have filled every blank, so it must never reach the client bundle.
 * `import "server-only"` turns an accidental client import into a build error.
 *
 * Writing a template:
 * - `{key}` in `story` is replaced by the answer to the blank with that key. A
 *   key may appear several times — the repeats are often the punchline.
 * - `blanks` is the ORDER THE QUESTIONS ARE ASKED, deliberately not story order,
 *   so the sequence of questions gives nothing away.
 * - A blank's `label` describes the word, never its role in the story
 *   ("一种动物", not "偷吃午饭的动物").
 * - The sentences have to read correctly whatever word lands in a blank — the
 *   joke is the word, not broken grammar.
 */
export type Template = {
  id: string;
  title: string;
  teaser: string;
  blanks: Blank[];
  story: string;
};

export const TEMPLATES: Template[] = [
  {
    id: "lunch",
    title: "午饭保卫战",
    teaser: "有人动了你的午饭。",
    blanks: [
      { key: "animal", label: "一种动物", examples: ["羊驼", "企鹅", "仓鼠", "哈士奇"] },
      { key: "name", label: "一个朋友的名字", examples: ["小明", "王老师", "隔壁老李"] },
      { key: "sound", label: "一个拟声词", examples: ["嘎嘎", "咕噜咕噜", "叮咚"] },
      { key: "food", label: "一种食物", examples: ["火锅", "螺蛳粉", "煎饼果子", "臭豆腐"] },
      { key: "number", label: "一个数字", examples: ["3", "250", "9999"] },
      { key: "place", label: "一个地点", examples: ["月球", "公司茶水间", "菜市场"] },
      { key: "action", label: "一个动作（几个字的短语）", examples: ["跳广场舞", "做俯卧撑", "背圆周率"] },
      { key: "adjective", label: "一个形容词", examples: ["毛茸茸", "气势汹汹", "油光锃亮"] },
    ],
    story: `中午十二点，{name}饿得前胸贴后背，冲进了{place}。
没想到，一只{adjective}的{animal}正坐在餐桌前，大口吃着{name}的{food}。
{name}大喊：「这是我的午饭！」
{animal}慢慢抬起头，「{sound}」地叫了一声，然后当着所有人的面开始{action}。
围观群众纷纷鼓掌，当场给它打赏了{number}块钱。
{name}默默掏出手机，点了一份外卖，备注：千万别让{animal}知道。`,
  },
  {
    id: "interview",
    title: "面试现场",
    teaser: "这份工作，你志在必得。",
    blanks: [
      { key: "object", label: "一件日常物品", examples: ["拖鞋", "电饭煲", "晾衣架", "保温杯"] },
      { key: "name", label: "你自己的名字", examples: ["我", "小王", "张三"] },
      { key: "number", label: "一个数字", examples: ["8", "72", "1000"] },
      { key: "adjective", label: "一个形容词", examples: ["亮晶晶", "黏糊糊", "金光闪闪"] },
      { key: "celebrity", label: "一个名人", examples: ["周杰伦", "马斯克", "孙悟空"] },
      { key: "job", label: "一个职业", examples: ["宇航员", "幼儿园老师", "相声演员"] },
      { key: "food", label: "一种食物", examples: ["大白菜", "茶叶蛋", "小龙虾"] },
      { key: "action", label: "一个动作（几个字的短语）", examples: ["打太极", "原地转圈", "倒立"] },
    ],
    story: `{name}去面试{job}，特意穿了一身{adjective}的西装。
面试官问：「你最大的缺点是什么？」
{name}想了想：「我这个人，太{adjective}了。」
面试官点点头：「那你最大的优点呢？」
{name}从包里掏出一个{object}：「我能拿着它{action}，连续{number}个小时。」
面试官沉默了很久，转身喊：「快去把{celebrity}叫来！」
第二天，{name}收到了录用通知。岗位：{object}管理员。工资按{food}结算。`,
  },
  {
    id: "date",
    title: "第一次约会",
    teaser: "心跳加速，一切都要完美。",
    blanks: [
      { key: "song", label: "一首歌的名字", examples: ["孤勇者", "小苹果", "两只老虎"] },
      { key: "vehicle", label: "一种交通工具", examples: ["共享单车", "拖拉机", "滑板车"] },
      { key: "crush", label: "一个人的名字", examples: ["小红", "李华", "楼下张阿姨"] },
      { key: "food", label: "一种食物", examples: ["榴莲", "大蒜", "韭菜盒子"] },
      { key: "number", label: "一个数字", examples: ["2", "38", "666"] },
      { key: "name", label: "另一个人的名字", examples: ["小明", "阿强", "老板"] },
      { key: "adjective", label: "一个形容词", examples: ["高冷", "接地气", "神秘"] },
      { key: "place", label: "一个地点", examples: ["驾校", "宜家", "派出所门口"] },
    ],
    story: `{name}和{crush}第一次约会，约在了{place}。
为了显得{adjective}一点，{name}骑着一辆{vehicle}准时出现。
{crush}看了一眼，问：「你身上怎么有股{food}味？」
{name}不慌不忙，单膝跪地，深情地唱起了《{song}》。
唱到一半，路过的{number}位大爷大妈也加入了合唱。
约会结束，{crush}红着脸说：「下次……能不能把{vehicle}也带上？」`,
  },
];
