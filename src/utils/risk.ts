import { Page } from 'playwright';

export type RiskSignal = {
  label: string;
  reason: string;
};

const DEFAULT_RISK_PATTERNS: Array<{ label: string; pattern: RegExp }> = [
  {
    label: 'rate-limit',
    pattern: /rate limit|too many requests|请求过多|频率限制|请稍后再试/i,
  },
  {
    label: 'account-restricted',
    pattern:
      /account locked|account suspended|temporarily restricted|temporarily limited|unusual activity|verify your account|账号已锁定|账号已暂停|异常活动|请验证|访问受限|suspended/i,
  },
  {
    label: 'page-error',
    pattern: /something went wrong|出了点问题|出错了|发生错误/i,
  },
];

function getPathname(url: string): string {
  try {
    return new URL(url).pathname;
  } catch {
    return url;
  }
}

export async function detectRiskSignal(
  page: Page,
  context: string,
  extraPatterns: string[] = []
): Promise<RiskSignal | null> {
  const url = page.url();
  const pathname = getPathname(url);

  if (/^\/(i\/flow|login|account\/access|account\/suspended)/i.test(pathname)) {
    return {
      label: 'session-blocked',
      reason: `检测到登录/验证/账号访问页面 (${context}): ${url}`,
    };
  }

  let text = '';
  try {
    const alerts = await page.locator('[role="alert"], [data-testid="toast"]').allTextContents();
    text = alerts.join(' ').trim();
  } catch {
    text = '';
  }

  if (!text) {
    try {
      text = await page.locator('body').innerText({ timeout: 2000 });
    } catch {
      text = '';
    }
  }

  if (!text) {
    return null;
  }

  for (const pattern of extraPatterns) {
    if (pattern && text.toLowerCase().includes(pattern.toLowerCase())) {
      return {
        label: 'configured-risk-text',
        reason: `检测到风险文案: ${pattern} (${context})`,
      };
    }
  }

  for (const item of DEFAULT_RISK_PATTERNS) {
    if (item.pattern.test(text)) {
      return {
        label: item.label,
        reason: `检测到阻断提示 (${item.label})，请稍后重试或人工处理 (${context})`,
      };
    }
  }

  return null;
}
