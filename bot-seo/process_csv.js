const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '../dados e palavras chaves');
const outputFile = path.join(__dirname, 'keywords.json');

const files = fs.readdirSync(dataDir);
const csvFiles = files.filter(f => f.startsWith('Keyword Stats') && f.endsWith('.csv'));

let allKeywords = [];
let keywordSet = new Set();

csvFiles.forEach(file => {
  const filePath = path.join(dataDir, file);
  try {
    const content = fs.readFileSync(filePath, 'utf16le');
    const lines = content.split('\n');
    let dataStarted = false;
    
    for (let line of lines) {
      line = line.trim();
      if (!line) continue;
      
      if (line.startsWith('Keyword\t') || line.startsWith('Keyword\tCurrency')) {
        dataStarted = true;
        continue;
      }
      
      if (dataStarted) {
        const columns = line.split('\t');
        if (columns.length >= 3) {
          let kw = columns[0].trim();
          let volStr = columns[2].trim();
          let volume = parseInt(volStr, 10);
          
          if (kw && !isNaN(volume) && volume > 0) {
            // Limpeza básica da palavra-chave
            kw = kw.toLowerCase().replace(/["']/g, '');
            // Evitar duplicatas
            if (!keywordSet.has(kw)) {
              keywordSet.add(kw);
              allKeywords.push({ keyword: kw, volume: volume });
            }
          }
        }
      }
    }
  } catch (err) {
    console.error('Erro ao ler o arquivo', file, err.message);
  }
});

// Ordenar por maior volume
allKeywords.sort((a, b) => b.volume - a.volume);

fs.writeFileSync(outputFile, JSON.stringify(allKeywords, null, 2), 'utf8');
console.log(`Processamento concluído. Encontradas ${allKeywords.length} palavras-chave únicas.`);
console.log(`Salvo em: ${outputFile}`);
