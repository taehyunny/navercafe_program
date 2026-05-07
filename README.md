# 네이버 카페 게시글 원문 추출기

네이버 카페에서 내가 볼 수 있는 게시글 목록을 수집하고, 각 게시글 본문을 Markdown 파일로 저장하는 Chrome 확장 프로그램입니다.

이 프로젝트의 핵심 방향은 **자동 요약보다 원문 보존**입니다. 확장 프로그램 안에서 허술한 요약을 만들기보다, 게시글 하나당 원문 Markdown 파일 하나를 저장한 뒤 NotebookLM 같은 도구에서 요약, 질문 생성, 개념 정리를 진행하는 흐름을 권장합니다.

## 프로젝트 위치

확장 프로그램 코드는 아래 폴더에 있습니다.

```text
tools/naver-cafe-exporter-extension
```

자세한 사용법 문서는 아래 파일을 참고하세요.

- [한글 사용법 문서](tools/naver-cafe-exporter-extension/docs/사용법.md)
- [설계 문서](tools/naver-cafe-exporter-extension/docs/design.md)

## 주요 기능

- 네이버 카페 목록 화면에서 게시글 15개 등 현재 보이는 게시글 수집
- `title`, `url`, `articleId`, `clubId` 추출
- 게시글 본문 원문 추출
- 게시글 하나당 Markdown 파일 하나로 저장
- JSON, CSV, 통합 Markdown export 지원
- 실행 단계별 로그 출력

## 설치 방법

1. Chrome 주소창에 `chrome://extensions`를 입력합니다.
2. 오른쪽 위 `개발자 모드`를 켭니다.
3. `압축해제된 확장 프로그램을 로드합니다`를 클릭합니다.
4. 아래 폴더를 선택합니다.

```text
tools/naver-cafe-exporter-extension
```

## 사용 순서

1. Chrome에서 네이버 카페에 로그인합니다.
2. 내가 쓴 글 목록 또는 추출하려는 게시글 목록 화면을 엽니다.
3. 확장 프로그램 아이콘을 클릭합니다.
4. `Collect` 버튼으로 게시글 목록을 수집합니다.
5. `Document` 버튼으로 각 게시글 본문을 추출합니다.
6. `Files` 버튼으로 게시글 하나당 Markdown 파일 하나씩 저장합니다.

## 저장 파일 예시

`Files` 버튼을 누르면 아래처럼 글 하나당 `.md` 파일 하나가 저장됩니다.

```text
naver-cafe-articles-2026-05-07T06-20-00-000Z/
01-62273-2026 05 06 개발일지 문서 객체화 공유하기.md
02-62262-2026 05 05 개발일지 Claim check 프로젝트 적용.md
03-62261-2026 05 05 개발일지 Buffer 종류.md
```

각 파일 구조는 다음과 같습니다.

```md
---
title: 게시글 제목
url: https://cafe.naver.com/ArticleRead.nhn?clubid=...
articleId: 62273
clubId: 28969626
category: 게시판 이름
sourceType: rendered-tab
extractedAt: 2026-05-07T06:20:00.000Z
---

# Original Body

게시글 본문 원문...
```

## NotebookLM 활용 예시

저장된 Markdown 파일을 NotebookLM에 업로드한 뒤 아래처럼 요청할 수 있습니다.

```text
이 Markdown 파일들은 네이버 카페에 작성한 개발일지 원문입니다.
각 문서를 다음 형식으로 정리해 주세요.

1. 주제
2. 핵심 개념
3. 내가 배운 점
4. 아직 검증해야 할 질문
5. 다음 실험 또는 구현 과제

원문에 없는 내용은 추측하지 말고, 추측이 필요한 부분은 "검증 필요"로 표시해 주세요.
```

## 검증 기준

한 번 더 생각해볼 기준은 이것입니다.

- `# Original Body`가 실제 게시글 본문과 일치하는가?
- `bodyLength`가 너무 작지 않은가?
- 코드 블록, 긴 문단, 이미지 설명이 빠지지 않았는가?
- 원문 검증 전에 요약 결과를 신뢰하고 있지 않은가?

이 프로젝트는 원문을 최대한 안전하게 보존하는 데 집중합니다. 요약과 해석은 검증된 원문 파일을 기반으로 다음 단계에서 처리하는 것이 좋습니다.

## 테스트

확장 프로그램 폴더에서 아래 명령을 실행할 수 있습니다.

```bash
cd tools/naver-cafe-exporter-extension
node tests/sample-extractor-test.js
node tests/article-fetcher-test.js
node tests/article-documenter-test.js
```
