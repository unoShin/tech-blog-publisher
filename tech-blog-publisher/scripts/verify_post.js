const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const targetFile = process.argv[2];
if (!targetFile) {
  console.error('❌ Error: Please specify the target markdown file to verify.');
  process.exit(1);
}

const absolutePath = path.resolve(targetFile);
if (!fs.existsSync(absolutePath)) {
  console.error(`❌ Error: File not found at ${absolutePath}`);
  process.exit(1);
}

const content = fs.readFileSync(absolutePath, 'utf8');

let errors = [];
let warnings = [];

console.log(`\n🔍 [LINTER] Verifying posting guidelines for: ${path.basename(absolutePath)}...`);

// 1. Front-matter Parsing
const frontMatterRegex = /^---\r?\n([\s\S]+?)\r?\n---/;
const match = content.match(frontMatterRegex);

if (!match) {
  errors.push('YAML Front-matter block is missing or improperly formatted.');
} else {
  const yamlText = match[1];
  const yamlLines = yamlText.split('\n');
  const yaml = {};
  
  yamlLines.forEach(line => {
    const colonIndex = line.indexOf(':');
    if (colonIndex > -1) {
      const key = line.substring(0, colonIndex).trim();
      const val = line.substring(colonIndex + 1).trim().replace(/^["']|["']$/g, '');
      yaml[key] = val;
    }
  });

  // Verify Title Bracket rule
  if (!yaml.title) {
    errors.push('Front-matter "title" is missing.');
  } else if (!yaml.title.match(/\(.+\)$/)) {
    warnings.push(`Title "${yaml.title}" might be missing an English original title in brackets at the end.`);
  }

  // Verify tags length
  if (!yaml.tags) {
    errors.push('Front-matter "tags" list is missing.');
  } else {
    // Parse tags array format e.g., ["tag1", "tag2"]
    const tagsMatch = yamlText.match(/tags:\s*\[([\s\S]*?)\]/);
    if (tagsMatch) {
      const parsedTags = tagsMatch[1].split(',').map(t => t.trim().replace(/^["']|["']$/g, '')).filter(t => t);
      if (parsedTags.length < 10) {
        errors.push(`Tags count must be at least 10. Found only ${parsedTags.length} tags: [${parsedTags.join(', ')}]`);
      }
    } else {
      errors.push('Tags format is incorrect. Must be array style: ["tag1", "tag2"]');
    }
  }

  // Verify thumbnail is specified
  if (!yaml.thumbnail) {
    errors.push('Front-matter "thumbnail" is missing.');
  }
}

// 2. Strict Image checks (thumbnail in body restriction)
const bodyContent = content.replace(frontMatterRegex, '');
if (bodyContent.includes('thumbnail.jpg')) {
  errors.push('CRITICAL RULE VIOLATION: "thumbnail.jpg" must NOT be inserted inside the post body (Figure 1, etc.). Keep it in YAML front-matter only.');
}

// 3. LaTeX Symbol ($) check
if (bodyContent.includes('$')) {
  errors.push('CRITICAL RULE VIOLATION: LaTeX symbol "$" detected. Use backticks or raw code formatting instead for Tistory compatibility.');
}

// 4. Bold link bracket rule verification
// Violating patterns: **[Text](url)** or [**Text](url)** or [Text**](url)
const badBoldLinkRegex = /(\*\*\[[^\]]+\]\([^)]+\)\*\*|\[\*\*[^\]]+\]\([^)]+\)\*\*|\*\*\[[^\]]+\*\*\]\([^)]+\))/g;
const badLinksFound = bodyContent.match(badBoldLinkRegex);
if (badLinksFound) {
  badLinksFound.forEach(link => {
    errors.push(`Invalid bold-link style: "${link}". Rule states "**" markers must be inside brackets: "[**text**](url)"`);
  });
}

// 4-1. Bold-code nesting check (e.g. **`code`** or **text (`code`)**)
// Violating pattern: backticks inside a bold span, which causes markdown parsers to leave raw '**'
const boldSpanRegex = /\*\*([^*\n]+)\*\*/g;
let boldMatch;
while ((boldMatch = boldSpanRegex.exec(bodyContent)) !== null) {
  if (boldMatch[1].includes('`')) {
    errors.push(`CRITICAL RULE VIOLATION: Bold span contains inline code backticks: "**${boldMatch[1]}**". Markdown parsers will fail and output raw '**'. Separate bold and code: e.g., '**Text** (\`code\`)' or '\`code\`' independently.`);
  }
}

// 4-2. Strikethrough risk tilde check (~ in text causing <del> tag)
const paragraphs = bodyContent.split(/\n\s*\n/);
paragraphs.forEach((p, idx) => {
  // Count tildes outside code blocks
  const cleanP = p.replace(/```[\s\S]*?```/g, '').replace(/`[^`]+`/g, '');
  const tildes = (cleanP.match(/~/g) || []).length;
  if (tildes >= 2) {
    errors.push(`CRITICAL RULE VIOLATION: Multiple tildes (~) detected in paragraph ${idx + 1}. Marked parser will convert this to a strikethrough (<del>). Use en-dash (–) or Korean words (에서) instead.`);
  }
});

// 5. Figure sequential numbering check (captions in markdown & HTML)
const figureCaptionRegex = /Figure\s+(\d+):/gi;
let figMatch;
let foundFigures = [];
while ((figMatch = figureCaptionRegex.exec(bodyContent)) !== null) {
  foundFigures.push({
    num: parseInt(figMatch[1]),
    index: figMatch.index,
    fullText: figMatch[0]
  });
}

foundFigures.forEach((fig, idx) => {
  const expectedNum = idx + 1;
  if (fig.num !== expectedNum) {
    errors.push(`Figure sequential indexing error. Expected "Figure ${expectedNum}" but found "${fig.fullText}"`);
  }
});

// 6. Unnatural multi-parentheses translation check (e.g. Wan(万, 만))
const multiBracketRegex = /\b[A-Za-z0-9_-]+\s*\([\u4e00-\u9fa5]+,\s*[\uac00-\ud7a3]+\)/g;
const multiBracketFound = bodyContent.match(multiBracketRegex);
if (multiBracketFound) {
  multiBracketFound.forEach(mb => {
    errors.push(`Unnatural multi-bracket translation detected: "${mb}". Use simple name instead.`);
  });
}

// 7. Redundant Markdown Table directly after <figure> check
const redundantTableRegex = /<figure[\s\S]*?<\/figure>\s*(\r?\n)*\s*\|[^\n]+\|\s*\r?\n\s*\|[\s\:\-\|]+\|/g;
if (redundantTableRegex.test(bodyContent)) {
  errors.push(`Redundant Table detected directly under a <figure> image block. Choose either Figure image or Markdown table, do NOT insert both consecutively.`);
}

// 6. External reference URL status validation (curl/fetch emulation)
const urlRegex = /https?:\/\/[^\s\)\"\'\>]+/g;
let urlMatch;
let urlsToVerify = [];
while ((urlMatch = urlRegex.exec(bodyContent)) !== null) {
  const url = urlMatch[0].replace(/[\,\.\:\;\?]$/, ''); // clean trailing punctuation
  // Skip google drive CDN links or localhost
  if (!url.includes('googleusercontent.com') && !url.includes('localhost') && !urlsToVerify.includes(url)) {
    urlsToVerify.push(url);
  }
}

async function verifyUrls() {
  if (urlsToVerify.length === 0) return;
  console.log(`🌐 [URL CHECKER] Validating ${urlsToVerify.length} external reference links...`);
  
  const checkPromises = urlsToVerify.map(url => {
    return new Promise((resolve) => {
      const options = {
        method: 'HEAD',
        timeout: 5000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      };
      
      const reqModule = url.startsWith('https') ? https : http;
      
      const req = reqModule.request(url, options, (res) => {
        if (res.statusCode >= 400 && res.statusCode !== 405) {
          // If HEAD fails, double check with GET
          const getOptions = Object.assign({}, options, { method: 'GET' });
          const getReq = reqModule.request(url, getOptions, (getRes) => {
            if (getRes.statusCode === 404) {
              errors.push(`Broken Link found (404 Not Found): "${url}"`);
            } else if (getRes.statusCode >= 400) {
              warnings.push(`Link access warning: "${url}" returned HTTP status ${getRes.statusCode} (likely protected)`);
            }
            resolve();
          });
          getReq.on('error', () => {
            errors.push(`Broken Link found: "${url}" connection failed.`);
            resolve();
          });
          getReq.end();
        } else {
          resolve();
        }
      });
      
      req.on('error', () => {
        // Double check with GET on connection/HEAD error
        const getOptions = Object.assign({}, options, { method: 'GET' });
        const getReq = reqModule.request(url, getOptions, (getRes) => {
          if (getRes.statusCode === 404) {
            errors.push(`Broken Link found (404 Not Found): "${url}"`);
          } else if (getRes.statusCode >= 400) {
            warnings.push(`Link access warning: "${url}" returned HTTP status ${getRes.statusCode} (likely protected)`);
          }
          resolve();
        });
        getReq.on('error', () => {
          errors.push(`Broken Link found: "${url}" connection failed.`);
          resolve();
        });
        getReq.end();
      });
      
      req.end();
    });
  });
  
  await Promise.all(checkPromises);
}

verifyUrls().then(() => {
  // Output report
  if (warnings.length > 0) {
    console.log('\n⚠️  Warnings:');
    warnings.forEach(w => console.log(`  - ${w}`));
  }

  if (errors.length > 0) {
    console.error('\n❌ Guidelines verification FAILED:');
    errors.forEach(e => console.error(`  - ${e}`));
    console.error('\nPre-build lint check failed. Please resolve the critical errors above.');
    process.exit(1);
  } else {
    console.log('\n✅ Guidelines verification PASSED. Posting is safe to compile!');
    process.exit(0);
  }
}).catch(err => {
  console.error('Fatal error during lint execution:', err);
  process.exit(1);
});
