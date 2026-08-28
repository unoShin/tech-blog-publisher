---
name: tech-blog-publisher
description: Automated end-to-end technical blog publishing pipeline for AI research papers, model releases, and engineering blogs. Formats Markdown with 5-stage golden structure, captures interactive SVG/CSS diagrams via headless Chrome, generates Notion 2D thumbnails, auto-uploads assets to Google Drive CDN, compiles to Tistory-ready HTML, and enforces zero-defect quality linting.
---

# Tech Blog Publisher Skill (`tech-blog-publisher`)

A battle-tested, autonomous end-to-end technical blog publishing pipeline designed for AI research papers, model releases, and engineering blogs. It produces publication-ready, senior-engineer-level deep dives formatted for Tistory, complete with automated Google Drive CDN image hosting, high-res diagram capture, and strict zero-defect linting.

---

## 🎯 Trigger Conditions

Activate this skill whenever the user requests:
- Writing a new tech blog post from a paper (e.g. arXiv URL), tech blog URL, or announcement.
- Producing an in-depth, publication-ready deep dive for AI/ML/Software Engineering topics.
- Extracting diagrams/figures from web articles or PDFs and embedding them with CDN links.
- Building, compiling, and formatting Markdown posts into Tistory-compatible HTML.

---

## 🏛️ 1. Core Architecture & Writing Standards

### 1-1. The 5-Stage Golden Deep Dive Structure
Every blog post MUST follow this strict 5-stage narrative structure:

1. **[1. Hook & Paradigm Shift]**:
   - Compelling industry hook explaining why this technology/paper matters today.
   - Connect directly to real-world engineering pain points (e.g., GPU costs, KV cache explosion, reward hacking, multi-agent deadlocks).
2. **[2. Deep Architecture & Mathematical Mechanics]**:
   - Deconstruct core algorithms, formulas, or system architectures.
   - Embed high-res official diagrams or architecture figures (`Figure 1`, `Figure 2`).
3. **[3. Quantitative Benchmarks & Failure Breakpoint Analysis]**:
   - Present clean Markdown comparison tables comparing baselines and proposed systems.
   - Emphasize **where the system breaks down (Failure Breakpoints)** rather than just listing positive scores.
4. **[4. System Engineering & Production Discussion]**:
   - Production implementation details, memory/compute tradeoffs, and serving economics.
   - **No Fake Content**: Strictly adhere to facts in the paper/article without inventing arbitrary checklists or fake use cases.
5. **[5. Conclusion & Actionable Key Takeaways]**:
   - Conclude with a clean `> [!NOTE] 핵심 요약 (Key Takeaways)` card.
   - **No Duplicate References**: Never append a redundant `## 참고 문헌` section at the bottom since all links are unified in the top metadata card.

### 1-2. YAML Front-matter Specifications
```yaml
---
title: "한글 제목 (English Original Title)"
date: "YYYY-MM-DD"
category: "AI Robotics & Embodied Agents"
thumbnail: "thumbnail.jpg"
description: "포스팅의 핵심 내용을 요약한 1~2문장의 완결성 있는 단문"
tags: ["태그1", "태그2", "태그3", "태그4", "태그5", "태그6", "태그7", "태그8", "태그9", "태그10"] # 10개 이상 필수
---

> [!NOTE] 원문 공식 발표/논문 메타 정보
> * **제목**: Full Title
> * **저자/기관**: Authors and Organizations
> * **발표 채널/학회**: Conference / Blog Channel
> * **공식 링크**: [example.com/link](https://example.com/link)
> * **코드/저장소**: [github.com/repo](https://github.com/repo)
```

---

## 🖼️ 2. Visual Figures & Diagram Protocol

### 2-1. Real Official Image Priority & Mandatory SVG/CSS Capture
1. **Official Images First**: Always prioritize real official diagrams, charts, and photos from the source article or paper.
2. **Interactive SVG/CSS Diagrams (Lesson 26)**:
   - Modern technical blogs render diagrams as inline React/Tailwind/SVG components (`<svg>`, `.rounded-xl`, `.border`).
   - Run the headless Chrome capturer immediately:
     ```bash
     node scripts/capture_diagrams.js "<ARTICLE_URL>" "drafts/<POST_ID>/"
     ```
3. **PDF Figure Extraction**:
   - For arXiv PDFs, render pages at 200 DPI (`pdftoppm -png -r 200 paper.pdf page`) or use YOLO layout extractor, crop precisely, and visually verify with `view_file`.
4. **Figure Labeling**:
   - Label figures sequentially: `Figure 1`, `Figure 2`, `Figure 3` based on appearance in the post (ignore paper's original numbering).
   - Format:
     ```html
     <figure class="imageblock alignCenter" data-ke-mobilestyle="widthOrigin"><span data-url="fig1.png" data-phocus="fig1.png"><img src="fig1.png" alt="Figure 1. 설명." loading="lazy"></span><figcaption>Figure 1. 설명.</figcaption></figure>
     ```

### 2-2. Notion 2D Thumbnail Protocol
Generate thumbnails using `generate_image`:
- **Style**: Notion 2D Flat Vector illustration.
- **Palette**: Warm cream background (`#FAF9F6`), charcoal line-art (`#1C1917`), and exactly 1 vibrant accent color.
- **Strictly No Text**: Prompt MUST include `"Strictly no text, no labels, no letters, no numbers, no words anywhere in the image"`.
- **Max 7 Elements Rule (Lesson 25)**: Limit visual elements to 5–7 primary objects (1 central core + 3–5 branching metaphors).
- **Aspect Ratio**: 1:1 square (1024x1024), 15% generous padding margin.
- **Front-matter Only**: Never embed `thumbnail.jpg` as an inline Figure inside the post body.

---

## ⚙️ 3. Build & Compilation Pipeline

### 3-1. Prerequisites & Environment Setup
- **Node.js**: >= 18.0.0
- **Dependencies**: `npm install cheerio front-matter googleapis highlight.js marked`
- **Headless Chrome**: `/usr/bin/google-chrome` or `chromium-browser`
- **Google Drive CDN (Optional but Recommended)**:
  - Place `service_account.json` or `credentials.json` in project root for automated Google Drive CDN image hosting.
  - If Google Drive is not configured, the compiler will fall back to local relative paths or base64 images.

### 3-2. Compilation Command
```bash
node scripts/build.js drafts/<POST_ID>/index.md
```

### 3-3. What the Compiler Does:
1. **Pre-build Linter**: Checks 26 cumulative rules (no nested bold backticks, no multi-tilde strikethrough bugs, title English bracket check, 10+ tags).
2. **CDN Upload**: Compares image MD5 hashes, uploads new figures to Google Drive CDN, and adds `?v=timestamp` query for cache busting.
3. **TOC Generation**: Automatically injects hierarchical Table of Contents with smooth scrolling.
4. **Callout Styling**: Transforms GitHub Markdown alerts (`> [!NOTE]`, `> [!TIP]`, etc.) into modern HSL callout cards.
5. **Code Highlighting**: Injects `highlight.js` syntax coloring for all code snippets.
6. **Phocus Lightbox Support**: Adds `data-url` and `data-phocus` attributes for Tistory native gallery view.

---

## 🛡️ 4. Quality Verification Checklist (Zero-Defect Rules)

Before completing any post, verify:
- [ ] **No Raw Asterisks**: Run `grep -n "\*\*" dist/<POST_ID>/index.html` (Must be 0).
- [ ] **No Strikethrough Bugs**: Run `grep -n "<del>" dist/<POST_ID>/index.html` (Must be 0).
- [ ] **No Nested Bold Backticks**: Use `**Text** (`code`)` instead of `**`\`code\` `**`.
- [ ] **En-dash for Ranges**: Use `1.5배–1.9배` instead of `1.5배~1.9배`.
- [ ] **Figure Verification**: Every image visually inspected with `view_file`.
- [ ] **No Bottom References**: References unified in top `> [!NOTE]` card.

---

## 🚀 5. Deployment on Another Server / GitHub Repository

To deploy this publishing pipeline on any new server:

1. **Clone or Copy Skill Directory**:
   ```bash
   git clone <YOUR_SKILL_REPO> my-blog-agent
   cd my-blog-agent
   npm install
   ```
2. **Directory Structure**:
   ```text
   my-blog-agent/
   ├── drafts/             # Raw Markdown drafts & figures
   │   └── 260828_01/
   │       ├── index.md
   │       ├── thumbnail.jpg
   │       └── fig1.png
   ├── dist/               # Compiled standalone HTML outputs
   │   └── 260828_01/
   │       └── index.html
   ├── scripts/            # Build, drive, and capture scripts
   ├── templates/          # Base template.html and markdown templates
   └── references/         # Posting rules & lessons
   ```
3. **Run Build**:
   ```bash
   node scripts/build.js drafts/260828_01/index.md
   ```
4. **Publish**: Copy the content of `dist/260828_01/index.html` directly into Tistory's HTML editor mode.
