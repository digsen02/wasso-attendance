import { chromium } from 'playwright-core';
import { mkdir } from 'node:fs/promises';

const browser = await chromium.launch({
  executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  headless: true,
});

await mkdir('artifacts', { recursive: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
const errors = [];
page.on('console', message => message.type() === 'error' && errors.push(message.text()));
page.on('pageerror', error => errors.push(error.message));

await page.goto('http://127.0.0.1:5173', { waitUntil: 'networkidle' });
await page.screenshot({ path: 'artifacts/login.png', fullPage: true });

await page.getByRole('button', { name: '학생으로 시작하기' }).click();
await page.getByRole('button', { name: '출근부', exact: true }).click();
await page.setInputFiles('#pdf-upload', {
  name: 'my-attendance.pdf',
  mimeType: 'application/pdf',
  buffer: Buffer.from('%PDF-1.4 mock'),
});
await page.getByRole('button', { name: '최종 제출' }).click();
await page.getByText('제출 완료', { exact: true }).waitFor();
await page.screenshot({ path: 'artifacts/student-attendance.png', fullPage: true });

await page.getByRole('button', { name: '내 정보', exact: true }).click();
await page.getByRole('button', { name: '로그아웃' }).click();
await page.getByRole('button', { name: '관리자 로그인' }).click();
await page.getByRole('button', { name: '관리자로 시작하기' }).click();
await page.getByRole('button', { name: '학생 관리', exact: true }).click();
await page.getByPlaceholder('이름 또는 학번 검색').fill('이재민');
await page.getByText('이재민', { exact: true }).click();
await page.getByRole('heading', { name: '출근부 제출 상세' }).waitFor();
await page.screenshot({ path: 'artifacts/admin-detail.png', fullPage: true });

await page.setViewportSize({ width: 390, height: 844 });
await page.getByRole('button', { name: '닫기' }).click();
await page.getByRole('button', { name: '메뉴' }).click();
await page.getByRole('button', { name: '대시보드', exact: true }).click();
await page.screenshot({ path: 'artifacts/admin-mobile.png', fullPage: true });

console.log(JSON.stringify({ errors, title: await page.title(), url: page.url() }, null, 2));
await browser.close();

