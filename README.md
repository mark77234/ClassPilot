# ClassPilot

ClassPilot은 선생님이 수업 중 팀 구성, 주제 배정, 발표 순서, 타이머, 랜덤 뽑기, 투표 결과를 한 화면에서 조종하는 수업 진행 보조 웹앱입니다.

## 1차 MVP

- `Next.js + TypeScript` 기반 단일 웹앱
- 교사용 메인 컨트롤 화면
- 프로젝터용 큰 화면 모드(`/display`)
- 브라우저 `localStorage` 기반 세션 저장
- 학생 이름 입력 및 목록 관리
- 팀 개수 입력 후 랜덤 팀 생성
- 주제 목록 입력 후 팀별 랜덤 주제 배정
- 발표 순서 랜덤 생성
- 수업 타이머 시작, 정지, 초기화
- 랜덤 학생 뽑기
- 단일기기 데모용 투표 생성, 표 입력, 결과 막대그래프

1차에서는 서버 API, 데이터베이스, 인증, 학생 입장 코드, QR 접속, 실시간 동기화는 만들지 않습니다.

## 실행

```bash
npm install
npm run dev
```

브라우저에서 `http://localhost:3000`을 열면 교사용 화면을 사용할 수 있습니다. 큰 화면 모드는 교사용 화면의 버튼 또는 `http://localhost:3000/display`에서 열 수 있습니다.

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

- `Student`: id, name
- `Team`: id, name, students, topic
- `Topic`: id, title
- `Poll`: id, question, options, votes, status
- `TimerState`: duration, remaining, running
- `ClassSession`: students, teams, topics, presentationOrder, polls, timer, stageMode
