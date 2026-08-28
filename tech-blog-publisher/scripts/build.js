const fs = require('fs');
const path = require('path');
const fm = require('front-matter');
const marked = require('marked');
const hljs = require('highlight.js');
const cheerio = require('cheerio');
const { execSync } = require('child_process');
const { getOrCreateSubfolder, uploadImage } = require('./drive.js');

// Parse CLI arguments
const filePath = process.argv[2];
if (!filePath) {
  console.error('Error: Please provide a markdown file path.');
  console.error('Usage: node src/build.js drafts/my-post.md');
  process.exit(1);
}

const resolvedPath = path.resolve(filePath);
if (!fs.existsSync(resolvedPath)) {
  console.error(`Error: File not found at ${resolvedPath}`);
  process.exit(1);
}

// Run pre-build posting guideline verification
try {
  execSync(`node "${path.join(__dirname, 'verify_post.js')}" "${resolvedPath}"`, { stdio: 'inherit' });
} catch (err) {
  console.error('\n❌ Build aborted: Guidelines verification failed. Please fix the errors listed above.');
  process.exit(1);
}

// Read template and markdown files
const templatePath = path.join(__dirname, 'template.html');
if (!fs.existsSync(templatePath)) {
  console.error(`Error: Template file not found at ${templatePath}`);
  process.exit(1);
}

const templateSource = fs.readFileSync(templatePath, 'utf8');
const markdownSource = fs.readFileSync(resolvedPath, 'utf8');

// Helper fallback function for placeholders
function fallbackToPlaceholder($img, src, alt) {
  const fileName = path.basename(src);
  const placeholderHtml = `
  <div class="image-placeholder-box">
    <div class="placeholder-icon">📸</div>
    <div class="placeholder-text"><strong>[이미지 업로드 필요]</strong> 티스토리 기본 모드에서 이 박스를 지우고, 결과 폴더의 <strong>${fileName}</strong> 파일을 업로드하여 이곳에 삽입하세요.</div>
    ${alt ? `<div class="placeholder-desc">설명: ${alt}</div>` : ''}
  </div>`;
  
  const parent = $img.parent();
  if (parent.is('p') && parent.children().length === 1 && parent.text().trim() === '') {
    parent.replaceWith(placeholderHtml);
  } else {
    $img.replaceWith(placeholderHtml);
  }
}

async function run() {
  // 1. Parse Front Matter
  let content;
  try {
    content = fm(markdownSource);
  } catch (err) {
    console.error('Error parsing YAML front-matter:', err.message);
    process.exit(1);
  }

  const metadata = content.attributes;
  const markdownBody = content.body;

  // 2. Setup Marked Parser with Highlight.js
  const renderer = new marked.Renderer();

  // Custom code block rendering using highlight.js
  renderer.code = function(code, lang) {
    const validLang = lang && hljs.getLanguage(lang) ? lang : 'plaintext';
    const highlighted = hljs.highlight(code, { language: validLang }).value;
    return `<pre><code class="hljs language-${validLang}">${highlighted}</code></pre>`;
  };

  marked.setOptions({ renderer });

  // 3. Compile Markdown to HTML
  const rawHtmlBody = marked(markdownBody);

  // 4. Manipulate HTML with Cheerio (TOC & Callouts)
  const $ = cheerio.load(rawHtmlBody);

  // Fix bold text (e.g. **text**가) that marked failed to parse due to Korean particles
  $('*').contents().each((i, elem) => {
    if (elem.type === 'text') {
      const parent = $(elem).parent();
      if (parent.closest('pre, code').length === 0) {
        const text = elem.data;
        if (text && text.includes('**')) {
          const newHtml = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
          $(elem).replaceWith(newHtml);
        }
      }
    }
  });

  const inputDir = path.dirname(resolvedPath);

  // Determine if input is inside a subdirectory in drafts
  const relativeFromDrafts = path.relative(path.resolve(__dirname, '../drafts'), resolvedPath);
  const dirName = path.dirname(relativeFromDrafts);

  let outputDir = path.resolve(__dirname, '../dist');
  let outputFileName = '';
  let isSubdir = false;

  if (dirName !== '.' && dirName !== '..') {
    outputDir = path.join(outputDir, dirName);
    outputFileName = 'index.html';
    isSubdir = true;
  } else {
    const fileBasename = path.basename(resolvedPath, '.md');
    outputFileName = `${fileBasename}.html`;
  }

  // Get or create subfolder on Google Drive if compiling from a drafts subdirectory
  let targetFolderId = null;
  if (isSubdir) {
    try {
      targetFolderId = await getOrCreateSubfolder(dirName);
    } catch (err) {
      console.error(`- [구글 폴더 생성 실패] '${dirName}': ${err.message}`);
    }
  }

  // 4b. Process Images & Wrap in Tistory-native imageblock structure (Unified loop)
  const localImages = [];
  const imgs = $('img').get();
  for (const img of imgs) {
    const $img = $(img);
    const alt = $img.attr('alt') || '';
    let imgSrc = $img.attr('src') || '';
    
    // Skip if already processed (uploaded to Google Drive)
    const parentPhocus = $img.parent().attr('data-phocus');
    if (parentPhocus && parentPhocus.includes('lh3.googleusercontent.com')) {
      continue;
    }

    // 1. Upload local images to Google Drive and resolve CDN link
    if (imgSrc && !imgSrc.match(/^(https?:|data:|\/\/)/)) {
      const srcImgPath = path.resolve(inputDir, imgSrc);
      const fileName = path.basename(imgSrc);
      localImages.push(fileName);

      if (fs.existsSync(srcImgPath)) {
        try {
          const driveUrl = await uploadImage(srcImgPath, targetFolderId, 'image/png');
          imgSrc = `${driveUrl}?v=${Date.now()}`;
          $img.attr('src', imgSrc);
          console.log(`- [자동 업로드 완료] ${fileName} -> ${imgSrc}`);
        } catch (err) {
          console.error(`- [업로드 실패] ${fileName}: ${err.message}`);
          fallbackToPlaceholder($img, imgSrc, alt);
          continue;
        }
      } else {
        console.warn(`- [이미지 없음] 로컬 파일을 찾을 수 없습니다: ${srcImgPath}`);
        fallbackToPlaceholder($img, imgSrc, alt);
        continue;
      }
    }

    // 2. Wrap image in Tistory-native imageblock (phocus viewer support)
    let $wrapper = $img;
    let captionText = '';
    let isCaption = false;
    let $next = null;
    let shouldRemoveNext = false;

    // If parent is a paragraph, that's our target wrapper
    if ($img.parent().is('p')) {
      $wrapper = $img.parent();
      
      // Case 1: Caption is inside the same <p> block (no blank line)
      $wrapper.contents().each((j, child) => {
        const $child = $(child);
        const text = $child.text().trim();
        if (/^(Figure|그림)\s*\d+/i.test(text)) {
          captionText = text;
          isCaption = true;
        }
      });
    } 
    // If parent is an HTML figure tag written in Markdown, replace the whole figure
    else if ($img.closest('figure').length > 0) {
      $wrapper = $img.closest('figure');
      const $figcaption = $wrapper.find('figcaption');
      if ($figcaption.length > 0) {
        captionText = $figcaption.text().trim();
        isCaption = true;
      }
    }

    // Case 2: Caption is in the next sibling block
    if (!isCaption) {
      $next = $wrapper.next();
      if ($next.length > 0 && $next.is('p')) {
        const text = $next.text().trim();
        const html = $next.html().trim();
        const startsWithFigure = /^(Figure|그림)\s*\d+/i.test(text);
        const isItalic = (html.startsWith('<em>') && html.endsWith('</em>')) || (html.startsWith('<i>') && html.endsWith('</i>'));
        
        if (startsWithFigure || isItalic) {
          captionText = text;
          isCaption = true;
          shouldRemoveNext = true;
        }
      }
    }

    // Fallback alt caption
    if (!isCaption && alt && /^(Figure|그림)\s*\d+/i.test(alt.trim())) {
      captionText = alt.trim();
      isCaption = true;
    }
    
    // Build Tistory-native imageblock HTML with data-phocus for native image viewer
    const finalImgSrc = $img.attr('src') || imgSrc;
    let replacementHtml = `<figure class="imageblock alignCenter" data-ke-mobileStyle="widthOrigin">`;
    replacementHtml += `<span data-url="${finalImgSrc}" data-phocus="${finalImgSrc}">`;
    replacementHtml += `<img src="${finalImgSrc}" alt="${alt}" loading="lazy">`;
    replacementHtml += `</span>`;
    if (isCaption && captionText) {
      replacementHtml += `<figcaption>${captionText}</figcaption>`;
      if (shouldRemoveNext && $next) {
        $next.remove();
      }
    }
    replacementHtml += `</figure>`;
    
    $wrapper.replaceWith(replacementHtml);
  }

  // 4a. Process Callouts (GitHub Alerts like > [!NOTE]) - Enhanced with Custom Titles & Icons
  $('blockquote').each((i, elem) => {
    const $el = $(elem);
    const firstP = $el.find('p').first();
    if (firstP.length > 0) {
      const pText = firstP.html().trim();
      // Match the prefix [!TYPE] and optionally a custom title text on the same line
      const match = pText.match(/^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION|SUCCESS)\]([^\n<]*)(?:\s|<br>|<br\s*\/?>)*/i);
      
      if (match) {
        const type = match[1].toUpperCase();
        const customTitle = match[2] ? match[2].trim() : '';
        
        let calloutClass = 'callout-info';
        let defaultTitle = '정보';
        let icon = '💡';
        
        if (type === 'WARNING' || type === 'CAUTION') {
          calloutClass = 'callout-warning';
          defaultTitle = '경고';
          icon = '⚠️';
        } else if (type === 'SUCCESS') {
          calloutClass = 'callout-success';
          defaultTitle = '성공';
          icon = '✅';
        } else if (type === 'TIP') {
          calloutClass = 'callout-tip';
          defaultTitle = '팁';
          icon = '⚡';
        } else if (type === 'IMPORTANT') {
          calloutClass = 'callout-important';
          defaultTitle = '중요';
          icon = '📌';
        }
        
        const title = customTitle || defaultTitle;
        
        // Remove only the matched prefix and title part, preserving all subsequent HTML content
        const remainingHtml = pText.slice(match[0].length);
        if (remainingHtml.trim()) {
          firstP.html(remainingHtml);
        } else {
          firstP.remove();
        }
        
        const innerContent = $el.html();
        $el.replaceWith(`
          <div class="callout ${calloutClass}">
            <div class="callout-title"><span class="callout-icon">${icon}</span>${title}</div>
            ${innerContent}
          </div>
        `);
      }
    }
  });

  // 4b. Scan Headings for TOC
  const tocItems = [];
  $('h2, h3').each((i, elem) => {
    const $el = $(elem);
    const text = $el.text().trim();
    const tagName = elem.name.toLowerCase();
    
    // Generate a clean slug for anchor IDs
    let slug = text
      .toLowerCase()
      .replace(/[^\w\sㄱ-ㅎㅏ-ㅣ가-힣-]/g, '') // allow Korean characters
      .trim()
      .replace(/\s+/g, '-');
    
    // Ensure uniqueness
    let finalSlug = slug;
    let counter = 1;
    while ($(`#${finalSlug}`).length > 0) {
      finalSlug = `${slug}-${counter}`;
      counter++;
    }
    
    $el.attr('id', finalSlug);
    
    tocItems.push({
      level: tagName,
      text: text,
      link: `#${finalSlug}`
    });
  });

  // Build TOC HTML (Pure div-based structure to eliminate skin list indentation issues)
  let tocHtml = '';
  if (tocItems.length > 0) {
    tocHtml = `
    <nav class="toc-container" aria-label="대화형 목차" role="doc-toc">
      <div class="toc-title">목차</div>
      <div class="toc-list">
        ${tocItems.map(item => `
          <div class="toc-item toc-${item.level}">
            <a href="${item.link}">${item.text}</a>
          </div>
        `).join('')}
      </div>
    </nav>`;
  }

  // Extract final body content from Cheerio load
  const finalContentHtml = $('body').html();

  // 5. Check for thumbnail in input directory
  const thumbnailNames = ['thumbnail.png', 'thumbnail.jpg', 'thumbnail.jpeg'];
  let foundThumbnail = '';
  for (const name of thumbnailNames) {
    if (fs.existsSync(path.join(inputDir, name))) {
      foundThumbnail = name;
      break;
    }
  }

  // Upload thumbnail if found
  let uploadedThumbnailUrl = '';
  if (foundThumbnail) {
    const thumbPath = path.join(inputDir, foundThumbnail);
    try {
      uploadedThumbnailUrl = await uploadImage(thumbPath, targetFolderId, 'image/png');
    } catch (err) {
      console.error(`- [썸네일 업로드 실패]: ${err.message}`);
    }
  }

  // Extract plain text for SEO Description
  const $seo = cheerio.load($.html());
  $seo('h1, h2, h3, h4, h5, h6, pre, code, table, .toc-container, script, style').remove();
  let plainText = $seo.text()
    .replace(/\s+/g, ' ') // replace multiple spaces/newlines with a single space
    .trim();
  
  let seoDescription = '';
  if (metadata.description) {
    seoDescription = metadata.description;
  } else if (plainText.length > 0) {
    seoDescription = plainText.substring(0, 150).trim();
    if (plainText.length > 150) {
      seoDescription += '...';
    }
  } else {
    seoDescription = title;
  }

  let tldrHtml = '';
  if (seoDescription) {
    tldrHtml = `
  <div class="tldr-box">
    <div class="tldr-title">TL;DR (요약)</div>
    <div class="tldr-content">${seoDescription}</div>
  </div>`;
  }

  const title = metadata.title || path.basename(resolvedPath, '.md');

  // Generate JSON-LD Schema (TechArticle) for Google Search SEO Structured Data
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "TechArticle",
    "headline": title,
    "description": seoDescription,
    "datePublished": metadata.date || new Date().toISOString().split('T')[0],
    "inLanguage": "ko-KR",
    "author": {
      "@type": "Person",
      "name": "Tech Blog Agent"
    }
  };
  if (uploadedThumbnailUrl) {
    jsonLd.image = [uploadedThumbnailUrl];
  }
  const jsonLdScript = `\n<script type="application/ld+json">\n${JSON.stringify(jsonLd, null, 2)}\n</script>\n`;

  // 6. Wrap in template
  let outputHtml = templateSource
    .replace('{{TOC}}', tocHtml)
    .replace('{{TLDR}}', tldrHtml)
    .replace('{{CONTENT}}', jsonLdScript + finalContentHtml);

  // Add metadata comment at the top for reference
  const tags = Array.isArray(metadata.tags) ? metadata.tags.join(', ') : (metadata.tags || '');
  const metaComment = `<!--
[티스토리 포스팅 메타데이터]
제목: ${title}
태그: ${tags}
작성일: ${metadata.date || new Date().toISOString().split('T')[0]}
카테고리: ${metadata.category || ''}
썸네일 링크: ${uploadedThumbnailUrl || '없음'}
SEO 요약문: ${seoDescription}
-->\n`;

  outputHtml = metaComment + outputHtml;

  // 7. Write output file
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const outputPath = path.join(outputDir, outputFileName);
  fs.writeFileSync(outputPath, outputHtml, 'utf8');

  // Copy thumbnail if found (for backup/local review)
  if (foundThumbnail) {
    fs.copyFileSync(path.join(inputDir, foundThumbnail), path.join(outputDir, foundThumbnail));
  }

  // Copy all detected local images to the output directory (for backup/local review)
  localImages.forEach(imgName => {
    const srcImgPath = path.join(inputDir, imgName);
    const destImgPath = path.join(outputDir, imgName);
    if (fs.existsSync(srcImgPath)) {
      fs.copyFileSync(srcImgPath, destImgPath);
      console.log(`- [로컬 백업 완료] ${imgName} -> ${path.relative(path.resolve(__dirname, '..'), destImgPath)}`);
    }
  });

  const displayOutputPath = isSubdir ? `dist/${dirName}/index.html` : `dist/${outputFileName}`;

  console.log('==================================================');
  console.log('🎉 블로그 빌드 완료! (Build Successful)');
  console.log(`- 입력 파일: ${filePath}`);
  console.log(`- 출력 파일: ${displayOutputPath}`);
  if (uploadedThumbnailUrl) {
    console.log(`- 업로드된 구글 드라이브 썸네일: ${uploadedThumbnailUrl}`);
  }
  console.log('==================================================');
  console.log(`📌 티스토리 업로드용 메타 정보:`);
  console.log(`- 제목: ${title}`);
  console.log(`- 태그: ${tags}`);
  console.log(`- SEO 요약문: ${seoDescription}`);
  console.log('==================================================');
  console.log(`💡 복사 방법: ${displayOutputPath} 소스를 열어 전체 복사 후,`);
  console.log('   티스토리 글쓰기 모드를 "HTML"로 변경하고 붙여넣으세요.');
  console.log('==================================================');
}

run().catch(err => {
  console.error('Build process failed:', err);
  process.exit(1);
});
