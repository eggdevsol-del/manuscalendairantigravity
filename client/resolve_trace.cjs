const https = require('https');
const { SourceMapConsumer } = require('source-map');

const url = 'https://www.tattoi.app/assets/index-Bonr0VyL.js.map';

const locations = [
  { line: 9, column: 59175 },
  { line: 9, column: 54098 },
  { line: 74, column: 96354 },
  { line: 74, column: 97962 },
  { line: 82, column: 91269 },
  { line: 82, column: 12556 }
];

https.get(url, (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', async () => {
    try {
      const rawSourceMap = JSON.parse(data);
      const consumer = await new SourceMapConsumer(rawSourceMap);
      
      console.log("--- SOURCEMAP RESOLUTION ---");
      locations.forEach(loc => {
        const original = consumer.originalPositionFor({
          line: loc.line,
          column: loc.column
        });
        console.log(`Line ${loc.line}:${loc.column} -> ${original.source}:${original.line}:${original.column} (name: ${original.name})`);
      });
      
      consumer.destroy();
    } catch (e) {
      console.error('Error parsing sourcemap', e);
    }
  });
}).on('error', (e) => {
  console.error("Failed to fetch", e);
});
