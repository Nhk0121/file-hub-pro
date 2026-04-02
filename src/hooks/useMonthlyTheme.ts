import { useEffect } from 'react';

// 每月色調配置 (HSL hue values)
const MONTHLY_THEMES: Record<number, { hue: number; name: string }> = {
  1:  { hue: 210, name: '冬藍' },    // 一月 - 冬季藍
  2:  { hue: 340, name: '梅紅' },    // 二月 - 新春紅
  3:  { hue: 150, name: '春綠' },    // 三月 - 早春綠
  4:  { hue: 120, name: '翠綠' },    // 四月 - 春季翠綠
  5:  { hue: 45,  name: '暖陽' },    // 五月 - 暖陽金
  6:  { hue: 180, name: '湖青' },    // 六月 - 初夏青
  7:  { hue: 200, name: '海藍' },    // 七月 - 盛夏藍
  8:  { hue: 25,  name: '橙暖' },    // 八月 - 夏末橙
  9:  { hue: 35,  name: '秋金' },    // 九月 - 初秋金
  10: { hue: 15,  name: '楓橘' },    // 十月 - 深秋橘
  11: { hue: 270, name: '紫韻' },    // 十一月 - 晚秋紫
  12: { hue: 215, name: '霜藍' },    // 十二月 - 冬季霜藍
};

export function getMonthlyTheme() {
  const month = new Date().getMonth() + 1;
  return MONTHLY_THEMES[month] || MONTHLY_THEMES[1];
}

export function useMonthlyTheme() {
  useEffect(() => {
    const theme = getMonthlyTheme();
    const root = document.documentElement;

    // 更新 CSS 變數 - 基於月份色相動態生成
    const h = theme.hue;
    root.style.setProperty('--primary', `${h} 80% 50%`);
    root.style.setProperty('--ring', `${h} 80% 50%`);
    root.style.setProperty('--accent', `${h} 75% 95%`);
    root.style.setProperty('--accent-foreground', `${h} 80% 40%`);

    // sidebar
    root.style.setProperty('--sidebar-primary', `${h} 80% 55%`);
    root.style.setProperty('--sidebar-ring', `${h} 80% 55%`);

    // dark mode overrides via class
    const darkStyle = document.getElementById('monthly-theme-dark');
    if (darkStyle) darkStyle.remove();
    const style = document.createElement('style');
    style.id = 'monthly-theme-dark';
    style.textContent = `
      .dark {
        --primary: ${h} 80% 55%;
        --ring: ${h} 80% 55%;
        --accent: ${h} 50% 20%;
        --accent-foreground: ${h} 80% 70%;
        --sidebar-primary: ${h} 80% 55%;
        --sidebar-ring: ${h} 80% 55%;
      }
    `;
    document.head.appendChild(style);

    return () => {
      const el = document.getElementById('monthly-theme-dark');
      if (el) el.remove();
    };
  }, []);

  return getMonthlyTheme();
}
