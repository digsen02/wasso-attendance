import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { mkdir } from 'node:fs/promises';

const browser=await chromium.launch({executablePath:'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',headless:true});
await mkdir('artifacts',{recursive:true});
const page=await browser.newPage({viewport:{width:1440,height:1000}});
const errors=[];page.on('console',m=>m.type()==='error'&&errors.push(m.text()));page.on('pageerror',e=>errors.push(e.message));

await page.goto('http://127.0.0.1:5173/admin/dashboard');
await page.waitForURL('**/login');
await page.getByRole('button',{name:'학생으로 시작하기'}).click();
await page.waitForURL('**/student');

await page.goto('http://127.0.0.1:5173/admin/dashboard');
await page.waitForURL('**/student');
await page.getByRole('link',{name:'출근부',exact:true}).click();
await page.getByLabel('2026-08-03 근무 내용').fill('수정된 콘텐츠 기획 업무');
await page.getByRole('button',{name:'임시 저장'}).click();
await page.getByText('임시 저장되었습니다.').waitFor();

await page.setInputFiles('#pdf-upload',{name:'wrong.txt',mimeType:'text/plain',buffer:Buffer.from('bad')});
await page.getByText('PDF 파일만 업로드할 수 있습니다.').waitFor();
await page.setInputFiles('#pdf-upload',{name:'attendance.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.4 mock')});
await page.getByText('출근부 8월 2023408 김회서.pdf',{exact:true}).waitFor();
await page.getByRole('button',{name:'최종 제출'}).click();
await page.getByText('출근부가 최종 제출되었습니다.').waitFor();
assert.equal(await page.getByRole('button',{name:'임시 저장'}).isDisabled(),true);
await page.screenshot({path:'artifacts/student-attendance.png',fullPage:true});

await page.getByRole('button',{name:'알림'}).click();
await page.getByText('8월 출근부 제출이 완료되었습니다.').waitFor();
await page.getByRole('button',{name:'알림 닫기'}).click();
await page.getByRole('link',{name:'내 정보'}).click();
await page.getByRole('main').getByRole('button',{name:'로그아웃',exact:true}).click();

await page.getByRole('button',{name:'관리자 로그인'}).click();
await page.getByRole('button',{name:'관리자로 시작하기'}).click();
await page.waitForURL('**/admin/dashboard');
await page.waitForFunction(()=>document.querySelector('.metric strong')?.textContent?.startsWith('7'));
const total=Number(await page.locator('.metric strong').first().innerText().then(t=>t.replace(/\D/g,'')));
assert.equal(total,7);
await page.getByRole('link',{name:'학생 관리',exact:true}).click();
await page.getByPlaceholder('이름 또는 학번 검색').fill('박서준');
await page.getByText('박서준',{exact:true}).click();
await page.getByRole('heading',{name:'출근부 제출 상세'}).waitFor();
await page.getByRole('button',{name:'승인'}).click();
await page.getByText('승인 처리되었습니다.').waitFor();
await page.locator('.modal .status.success').waitFor();
await page.screenshot({path:'artifacts/admin-detail.png',fullPage:true});

await page.goto('http://127.0.0.1:5173/student/attendance');
await page.waitForURL('**/admin/dashboard');
await page.setViewportSize({width:390,height:844});
await page.getByRole('button',{name:'메뉴'}).click();
await page.screenshot({path:'artifacts/admin-mobile.png',fullPage:true});

assert.deepEqual(errors,[]);
console.log(JSON.stringify({errors,totalStudents:total,routeGuards:'passed',pdfValidation:'passed',workflow:'passed'},null,2));
await browser.close();
