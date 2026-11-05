const { generateCircularPostRewrite, fallbackCircularRewrite } = require('../services/gemini');

async function main() {
  console.log('Testing gemini.js exports...');
  const sampleTemplate = {
    id: 'test_tpl_1',
    model_name: 'Dell Latitude 5350',
    brand: 'Dell',
    cpu: 'Intel Core Ultra 5',
    ram: '16GB',
    ssd: '256GB SSD',
    screen: '13.3 inch FHD IPS',
    price_display: '13.9 triệu',
    media_files: [{ filename: 'test.jpg', url: 'https://example.com/test.jpg' }]
  };

  console.log('\n--- 1. Testing fallbackCircularRewrite across 4 styles ---');
  const styles = ['featured_review', 'flash_sale', 'curated_pick', 'value_champion'];
  for (const s of styles) {
    const text = fallbackCircularRewrite(sampleTemplate, s);
    const title = text.split('\n')[0];
    console.log(`[Style: ${s}] Title: ${title}`);
  }

  console.log('\n--- 2. Testing generateCircularPostRewrite (Live or graceful fallback) ---');
  const liveResult = await generateCircularPostRewrite(sampleTemplate, 'featured_review');
  console.log('Is AI Generated:', liveResult.isAIGenerated);
  console.log('Model Used:', liveResult.modelUsed);
  console.log('First 2 lines:\n' + liveResult.content.split('\n').slice(0, 3).join('\n'));
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
