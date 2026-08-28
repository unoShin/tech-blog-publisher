# 📝 Tech Blog Publisher

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-≥18-green.svg)](https://nodejs.org/)
[![Python](https://img.shields.io/badge/Python-3.10+-yellow.svg)](https://www.python.org/)

> 기술 논문과 아티클을 시니어 엔지니어 수준의 한국어 테크 블로그 포스트로 자동 변환·컴파일·발행하는 AI 에이전트 스킬 패키지

---

## ✨ 소개

Tech Blog Publisher는 **AI 코딩 에이전트를 위한 스킬(Skill) 패키지**입니다.

arXiv 논문, AI 기업 공식 블로그, 기술 아티클을 입력하면, 에이전트가 자동으로 분석 → 구조화 → 한국어 블로그 작성 → 다이어그램 캡처 → 이미지 CDN 업로드 → HTML 컴파일 → 티스토리 발행까지 전 과정을 수행합니다.

### 이 프로젝트는 [Antigravity(AGY)](https://antigravity.dev)의 스킬 시스템을 기준으로 개발되었지만, SKILL.md의 구조와 프롬프트는 범용적으로 설계되어 있어 다른 AI 에이전트(Cursor, Cline, Windsurf, Claude Code 등)에서도 참고하거나 활용할 수 있습니다.

---

## 📦 포함된 스킬

이 저장소에는 **2개의 독립적인 스킬**이 포함되어 있으며, 파이프라인으로 연계됩니다:

| 스킬 | 경로 | 설명 |
|------|------|------|
| **Tech Blog Publisher** | `tech-blog-publisher/` | 기술 문서를 5단계 황금 구조의 한국어 블로그로 변환하고 티스토리 HTML로 컴파일 |
| **PDF Layout Extractor** | `pdf_layout_extractor/` | DocLayout-YOLO 모델로 PDF에서 도표·수식·그림을 정밀 추출 |

<p align="center">
  <img src="assets/pipeline.jpg" alt="Tech Blog Publisher Pipeline" width="720" />
</p>

---

## 🚀 빠른 시작

### 1. 저장소 복제 & 의존성 설치

```bash
git clone https://github.com/unoShin/tech-blog-publisher.git
cd tech-blog-publisher/tech-blog-publisher
npm install
```

### 2. 환경 설정

#### 필수 환경
- **Node.js** ≥ 18.0.0
- **Headless Chrome** (`google-chrome` 또는 `chromium-browser`) — 다이어그램 캡처 시 필요

#### 선택: Google Drive CDN 연동
이미지를 Google Drive CDN(`https://lh3.googleusercontent.com/d/...`)으로 자동 호스팅하려면:

1. [Google Cloud Console](https://console.cloud.google.com/)에서 프로젝트 생성
2. Google Drive API 활성화
3. 서비스 계정 키(`service_account.json`)를 프로젝트 루트에 배치
4. CDN 폴더를 만들고 서비스 계정 이메일을 **편집자**로 공유

> 💡 Google Drive를 설정하지 않으면 로컬 상대 경로로 빌드됩니다.

#### 선택: PDF 레이아웃 추출
논문 PDF에서 도표를 추출하려면:

- **Python** ≥ 3.10 (Conda 환경 권장)
- **DocLayout-YOLO** 모델 체크포인트 (`.pt` 파일)
- **pdftoppm** (`poppler-utils`)

---

## 📖 사용 방법

### AI 에이전트에서 스킬로 사용하기

#### Antigravity (AGY)

스킬 디렉토리를 Antigravity의 스킬 경로에 복사하거나 심볼릭 링크를 생성합니다:

```bash
# 글로벌 스킬로 등록
cp -r tech-blog-publisher ~/.gemini/config/skills/
cp -r pdf_layout_extractor ~/.gemini/config/skills/

# 또는 프로젝트 레벨 스킬로 등록
cp -r tech-blog-publisher <your-project>/.gemini/skills/
cp -r pdf_layout_extractor <your-project>/.gemini/skills/
```

등록 후 에이전트에게 자연어로 요청하면 됩니다:
```
"이 arXiv 논문을 분석해서 기술 블로그 포스트로 작성해줘"
"이 PDF에서 도표를 추출해줘"
```

#### 다른 AI 에이전트 (Cursor, Cline, Windsurf, Claude Code 등)

`SKILL.md` 파일은 에이전트에게 주어지는 **구조화된 시스템 프롬프트**로 설계되어 있습니다. 다음과 같이 활용할 수 있습니다:

1. **프롬프트로 직접 활용**: `SKILL.md`의 내용을 시스템 프롬프트나 커스텀 인스트럭션에 붙여넣기
2. **레퍼런스로 참고**: 5단계 황금 구조, 린팅 규칙, 스타일 가이드 등을 기술 블로그 작성 시 참고
3. **스크립트 독립 실행**: 빌드/린터/캡처 스크립트는 Node.js CLI로 독립 실행 가능

### 수동 워크플로우

#### Step 1: 초안 작성
`templates/post-template.md`를 복사하여 5단계 황금 구조에 맞춰 작성합니다:

```
drafts/260828_01/
├── index.md        # 마크다운 초안 (YAML Front-matter 포함)
├── thumbnail.jpg   # Notion 2D 썸네일
├── fig1.png        # 본문 이미지들
└── fig2.png
```

**5단계 황금 구조:**
1. 🪝 문제의식과 핵심 제안 (Hook & Paradigm Shift)
2. 🏗️ 심층 아키텍처 및 핵심 메커니즘 (Deep Architecture)
3. 📊 정량 벤치마크 및 브레이크포인트 분석 (Quantitative Benchmarks)
4. ⚙️ 시스템 구현 및 엔지니어링 분석 (System Engineering)
5. 🎯 결론 및 핵심 요약 (Conclusion & Key Takeaways)

#### Step 2: 다이어그램 캡처 (웹 아티클)
```bash
node scripts/capture_diagrams.js "https://example.com/blog-post" "drafts/260828_01/"
```

#### Step 3: PDF 도표 추출 (논문)
```bash
python scripts/extract_layout_images.py paper.pdf drafts/260828_01/
```

#### Step 4: 린트 검증
```bash
npm run verify -- drafts/260828_01/index.md
```

#### Step 5: 빌드
```bash
npm run build -- drafts/260828_01/index.md
```

#### Step 6: 발행
빌드 결과물(`dist/260828_01/index.html`)을 티스토리 HTML 에디터에 붙여넣기합니다.

---

## 🏗️ 프로젝트 구조

```
tech-blog-publisher/
├── tech-blog-publisher/              # 메인 스킬
│   ├── SKILL.md                      # 스킬 정의 (트리거, 워크플로우, 규칙)
│   ├── package.json                  # Node.js 의존성
│   ├── scripts/
│   │   ├── build.js                  # 린터 + CDN + 마크다운→HTML 통합 빌더
│   │   ├── drive.js                  # Google Drive CDN 증분 업로더
│   │   ├── verify_post.js            # 26대 규칙 Zero-Defect 린터
│   │   ├── capture_diagrams.js       # 헤드리스 크롬 다이어그램 캡처
│   │   └── extract_layout_images.py  # YOLO 기반 PDF 도표 추출
│   ├── templates/
│   │   ├── post-template.md          # 5단계 황금 구조 마크다운 템플릿
│   │   └── template.html             # 티스토리 최적화 HTML/CSS 테마
│   └── references/
│       ├── instructions.md           # 포스팅 파이프라인 마스터 규격
│       └── lessons.md                # 26대 품질 개선 교훈집
│
├── pdf_layout_extractor/             # 보조 스킬
│   └── SKILL.md                      # PDF 레이아웃 추출 스킬 정의
│
├── .gitignore
├── LICENSE
└── README.md                         # 본 문서
```

---

## 🛡️ Zero-Defect 린터 규칙 (주요)

빌드 전 자동 검증되는 핵심 품질 규칙들:

| # | 규칙 | 설명 |
|---|------|------|
| 1 | YAML Front-matter 필수 필드 | `title`, `date`, `category`, `thumbnail`, `description`, `tags` |
| 2 | 태그 10개 이상 | SEO를 위한 최소 태그 수 |
| 3 | 제목 영문 괄호 | `한글 제목 (English Title)` 형식 |
| 4 | 썸네일 본문 삽입 금지 | `thumbnail.jpg`는 Front-matter 전용 |
| 5 | LaTeX `$` 금지 | 티스토리 파싱 충돌 방지, 코드 백틱 사용 |
| 6 | Bold-Code 중첩 금지 | `**텍스트** (\`코드\`)` 형식으로 분리 |
| 7 | 물결표(`~`) 금지 | `<del>` 버그 방지, 엔 대시(`–`) 사용 |
| 8 | Figure 순번 검증 | Figure 1, 2, 3 순차 검증 |
| 9 | 외부 링크 활성 검증 | HTTP HEAD 요청으로 404 자동 탐지 |
| 10 | 중복 테이블 검출 | 이미지 테이블 + 마크다운 테이블 중복 방지 |

전체 26개 규칙은 [`lessons.md`](tech-blog-publisher/references/lessons.md)를 참고하세요.

---

## 🎨 HTML 테마 특징

컴파일된 HTML은 현대적인 에디토리얼 디자인을 적용합니다:

- **폰트**: Pretendard(본문), Newsreader(세리프 악센트), JetBrains Mono(코드)
- **코드 하이라이팅**: GitHub Dark 테마 (`highlight.js`)
- **콜아웃 카드**: NOTE, TIP, WARNING, IMPORTANT, CAUTION 5종
- **반응형**: 768px 모바일 브레이크포인트
- **TOC**: 자동 생성 목차 (스무스 스크롤)
- **Tistory 네이티브 지원**: `data-phocus` 라이트박스, JSON-LD SEO 스키마

---

## 🤝 기여하기

1. 이 저장소를 Fork합니다
2. Feature 브랜치를 생성합니다 (`git checkout -b feature/amazing-feature`)
3. 변경사항을 커밋합니다 (`git commit -m 'Add amazing feature'`)
4. 브랜치에 Push합니다 (`git push origin feature/amazing-feature`)
5. Pull Request를 생성합니다

### 기여 가능한 영역
- 다른 블로그 플랫폼 지원 (Velog, Medium, WordPress 등)
- 추가 린터 규칙
- 새로운 HTML 테마/템플릿
- 다국어 블로그 작성 지원

---

## 📄 라이선스

이 프로젝트는 [MIT 라이선스](LICENSE) 하에 배포됩니다.
