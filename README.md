# ClassPilot

ClassPilot은 선생님이 수업 이름, 학생 배치, 팀, 점수, 투표, 발표, 타이머를 순서대로 진행하고 큰 화면에 보여줄 수 있는 수업 진행 보조 웹앱입니다.

## 1차 MVP

- `Next.js + TypeScript` 기반 웹앱
- `시작하기 → 수업명 입력 → 학생 입력 → 메인 홈` 순서형 진입
- 홈, 액션, 팀 3개 섹션을 하단 플로팅 UI로 이동
- 액션별 전용 라우트(`/actions/[actionId]`)
- 프로젝터용 큰 화면 모드(`/display`)
- 브라우저 `localStorage` 기반 세션 저장
- 학생 한 명씩 입력, 즉시 배지 표시, 배지 삭제
- 학생 위치 자동 배치 및 드래그 앤 드롭 이동
- 팀 개수 입력 후 랜덤 팀 생성
- 팀별 직접 주제 배정
- 팀/개인 발표 순서 랜덤 생성
- 수업 타이머 시작, 정지, 초기화
- 랜덤 학생 뽑기
- 팀/개인 투표 생성, 표 입력, 결과 막대그래프
- 팀 점수 추가, 점수 룰렛, 우승 상품 설정, 최종 우승팀 발표

1차에서는 서버 API, 데이터베이스, 인증, 학생 입장 코드, QR 접속, 실시간 동기화는 만들지 않습니다.

## 실행

```bash
npm install
npm run dev
```

브라우저에서 `http://localhost:3000`을 열면 시작 화면부터 수업을 구성할 수 있습니다. 큰 화면 모드는 `http://localhost:3000/display`에서 열 수 있습니다.

## 검증

```bash
npm run test
npm run typecheck
npm run build
```

## 2차 로드맵

- 학생 입장 코드
- QR 접속
- 팀별 진행상황
- 도움 요청
- 공지 띄우기
- 발표 평가
- 수업 결과 리포트

## 3차 로드맵

- iOS 앱 리모컨
- 실시간 웹 화면 제어
- 푸시 알림
- 수업 템플릿 저장
- 과거 수업 기록
- 선생님 계정 기능

## 주요 데이터 타입

- `Student`: id, name, position
- `Team`: id, name, students, topic, score
- `Topic`: id, title
- `Poll`: id, question, options, votes, status
- `TimerState`: duration, remaining, running
- `ScoreEvent`: id, teamId, teamName, points, reason, createdAt
- `FinaleState`: finished, winnerTeamId, finishedAt
- `ClassSession`: className, appStep, mainSection, students, teams, polls, timer, reward, scoreEvents, finale
