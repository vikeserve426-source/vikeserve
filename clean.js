// clean.js - Run with: node clean.js
const fs = require('fs');
const path = require('path');

console.log('🧹 Starting automatic code cleaner...\n');

// Files and folders to clean
const filesToClean = [
    'scripts/firebase.js',
    'scripts/utils.js',
    'scripts/auth.js',
    'scripts/app.js',
    'scripts/services.js',
    'scripts/marketplace.js',
    'scripts/bookings.js',
    'scripts/housing.js',
    'scripts/more-menu.js',
    'scripts/intasend-global.js',
    'scripts/account.js',
    'scripts/admin.js',
    'scripts/quick-actions.js',
    'scripts/reviews.js',
    'scripts/search.js',
    'scripts/uploads.js',
    'style.css'
];

// Clean a single file
function cleanFile(filePath) {
    if (!fs.existsSync(filePath)) {
        console.log(`⚠️  File not found: ${filePath}`);
        return false;
    }

    let content = fs.readFileSync(filePath, 'utf8');
    let originalLength = content.length;
    let changes = [];

    // 1. Remove ALL console.log statements
    let newContent = content.replace(/console\.log\([^;]*\);?\s*/g, '');
    if (newContent !== content) changes.push('Removed console.log');

    // 2. Remove ALL console.warn statements
    newContent = newContent.replace(/console\.warn\([^;]*\);?\s*/g, '');
    if (newContent !== content) changes.push('Removed console.warn');

    // 3. Remove ALL console.info statements
    newContent = newContent.replace(/console\.info\([^;]*\);?\s*/g, '');
    if (newContent !== content) changes.push('Removed console.info');

    // 4. Remove ALL console.debug statements
    newContent = newContent.replace(/console\.debug\([^;]*\);?\s*/g, '');
    if (newContent !== content) changes.push('Removed console.debug');

    // 5. Remove ALL comment blocks (==========)
    newContent = newContent.replace(/\/\/ ========================================.*?\n/g, '');
    newContent = newContent.replace(/\/\/ ==========.*?==========\s*/g, '');
    newContent = newContent.replace(/\/\/ =======.*?=======\s*/g, '');

    // 6. Remove ALL single-line comments (//) that are not code
    // Keep only comments that start with // IMPORTANT, // TODO, // WARNING, // NOTE
    const lines = newContent.split('\n');
    const cleanedLines = [];
    let inMultiLineComment = false;

    for (let line of lines) {
        // Check for multi-line comment start
        if (line.includes('/*') && !line.includes('*/')) {
            inMultiLineComment = true;
            continue;
        }
        // Check for multi-line comment end
        if (inMultiLineComment && line.includes('*/')) {
            inMultiLineComment = false;
            continue;
        }
        // Skip multi-line comment lines
        if (inMultiLineComment) continue;

        // Skip single-line comments that are not important
        if (line.trim().startsWith('//')) {
            const trimmed = line.trim().toLowerCase();
            if (trimmed.includes('important') || 
                trimmed.includes('todo') || 
                trimmed.includes('warning') || 
                trimmed.includes('note') ||
                trimmed.includes('fixme')) {
                cleanedLines.push(line); // Keep important comments
            }
            // Skip all other comments
            continue;
        }

        // Remove empty lines (more than 2 consecutive)
        cleanedLines.push(line);
    }

    newContent = cleanedLines.join('\n');

    // 7. Remove multiple empty lines (more than 2)
    newContent = newContent.replace(/\n{4,}/g, '\n\n\n');

    // 8. Remove debugger statements
    newContent = newContent.replace(/debugger;?\s*/g, '');

    // 9. Remove trailing whitespace on each line
    newContent = newContent.replace(/[ \t]+$/gm, '');

    // 10. Remove FIX, ADDED, CHANGED comments in code
    newContent = newContent.replace(/\/\/ ========== FIX:.*?==========\s*/g, '');
    newContent = newContent.replace(/\/\/ ========== ADDED:.*?==========\s*/g, '');
    newContent = newContent.replace(/\/\/ ========== CHANGED:.*?==========\s*/g, '');

    // If nothing changed
    if (newContent === content) {
        console.log(`✅ ${filePath} - No changes needed`);
        return true;
    }

    // Write the cleaned content
    fs.writeFileSync(filePath, newContent, 'utf8');
    const newLength = newContent.length;
    const saved = originalLength - newLength;
    console.log(`✅ ${filePath} - Cleaned (saved ${saved} bytes) - ${changes.join(', ')}`);
    
    return true;
}

// Clean all files
console.log('📂 Cleaning files...\n');

let cleanedCount = 0;
let failedCount = 0;

filesToClean.forEach(file => {
    const fullPath = path.join(__dirname, file);
    if (cleanFile(fullPath)) {
        cleanedCount++;
    } else {
        failedCount++;
    }
});

console.log(`\n🎉 Done! Cleaned ${cleanedCount} files.`);

if (failedCount > 0) {
    console.log(`⚠️  ${failedCount} files could not be processed.`);
}

console.log('\n📝 Run "git status" to see changes.');
console.log('📝 Run "git diff" to review changes before committing.');