# 회사와쏘 Supabase 백엔드

## 로컬 실행

Docker Desktop을 실행한 뒤 프로젝트 루트에서 다음 명령을 실행합니다.

```bash
npm run backend:start
npm run backend:reset
npm run backend:test
```

명령 출력의 API URL과 anon key를 루트 `.env`의 `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`에 입력합니다.

## 원격 배포

```bash
npx supabase login
npx supabase link --project-ref <project-ref>
npx supabase db push
```

마이그레이션은 테이블, 인덱스, RLS, 인증 트리거, 제출/검토/Reminder RPC 및 비공개 PDF Storage 정책을 생성합니다.

## 관리자 생성

`.env.example`의 서버 전용 변수를 셸 환경에 설정한 후 실행합니다.

```bash
npm run backend:create-admin
```

`SUPABASE_SERVICE_ROLE_KEY`는 브라우저 코드나 `VITE_` 환경 변수에 넣으면 안 됩니다.
