// Test script to check Polymarket historical data API
const fetch = require('node-fetch');

async function testPolymarketHistory() {
  // Example CLOB token ID (you'll need to get a real one from your data)
  const marketId = "21742633143463906290569050155826241533067272736897614950488156847949938836287";
  
  const endTs = Math.floor(Date.now() / 1000);
  const startTs = endTs - (7 * 24 * 60 * 60); // 7 days ago
  
  const params = new URLSearchParams({
    market: marketId,
    fidelity: "60",
    startTs: startTs.toString(),
    endTs: endTs.toString()
  });
  
  const url = `https://clob.polymarket.com/prices-history?${params.toString()}`;
  console.log('Fetching from URL:', url);
  console.log('Start timestamp:', startTs, '(' + new Date(startTs * 1000).toISOString() + ')');
  console.log('End timestamp:', endTs, '(' + new Date(endTs * 1000).toISOString() + ')');
  
  try {
    const response = await fetch(url);
    const data = await response.json();
    
    console.log('\nResponse status:', response.status);
    console.log('Total data points:', data.history?.length || 0);
    
    if (data.history && data.history.length > 0) {
      // Show first 5 and last 5 data points
      console.log('\nFirst 5 data points:');
      data.history.slice(0, 5).forEach(point => {
        console.log(`  Time: ${point.t} (${new Date(point.t * 1000).toISOString()}), Price: ${point.p}`);
      });
      
      console.log('\nLast 5 data points:');
      data.history.slice(-5).forEach(point => {
        console.log(`  Time: ${point.t} (${new Date(point.t * 1000).toISOString()}), Price: ${point.p}`);
      });
      
      // Check for gaps in timestamps
      console.log('\nChecking for gaps in data...');
      const timestamps = data.history.map(p => p.t).sort((a, b) => a - b);
      const gaps = [];
      
      for (let i = 1; i < timestamps.length; i++) {
        const diff = timestamps[i] - timestamps[i-1];
        if (diff > 3700) { // More than ~1 hour gap
          gaps.push({
            start: new Date(timestamps[i-1] * 1000).toISOString(),
            end: new Date(timestamps[i] * 1000).toISOString(),
            gap: diff / 3600 + ' hours'
          });
        }
      }
      
      if (gaps.length > 0) {
        console.log('Found gaps:');
        gaps.forEach(gap => console.log(`  ${gap.start} to ${gap.end} (${gap.gap})`));
      } else {
        console.log('No significant gaps found');
      }
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

testPolymarketHistory();