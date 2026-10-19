const fs = require('fs');
const path = require('path');

const pdfPath = path.join(__dirname, '../assets/templates/CASH.pdf');
const outPath = path.join(__dirname, '../assets/templates/cashPdfBase64.ts');

const bytes = fs.readFileSync(pdfPath);
const b64 = bytes.toString('base64');
const tsContent = `// Auto-generated master CASH.pdf template in base64 format for 100% offline PDF overlay
export const CASH_PDF_BASE64 = '${b64}';
`;

fs.writeFileSync(outPath, tsContent, 'utf8');
console.log('Successfully generated cashPdfBase64.ts, length:', tsContent.length);
