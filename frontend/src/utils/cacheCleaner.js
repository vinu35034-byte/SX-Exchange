/**
 * Utility to clear problematic cached candlestick data
 * Run this in browser console if chart keeps showing errors
 */

function clearCandlestickCache() {
  console.log('🧹 Clearing candlestick cache...');
  
  let clearedCount = 0;
  const keys = [];
  
  // Collect all cache keys
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && (
      key.includes('candlestick') || 
      key.includes('chartData') || 
      key.includes('klines') ||
      key.includes('ATH') ||
      key.includes('PARA')
    )) {
      keys.push(key);
    }
  }
  
  // Clear the keys
  keys.forEach(key => {
    try {
      const data = localStorage.getItem(key);
      if (data) {
        const parsed = JSON.parse(data);
        console.log(`Checking cache key: ${key}`, parsed);
        
        // Check if data contains null values
        if (Array.isArray(parsed)) {
          const hasNulls = parsed.some(item => 
            !item || 
            item.open === null || 
            item.high === null || 
            item.low === null || 
            item.close === null ||
            isNaN(item.open) ||
            isNaN(item.high) ||
            isNaN(item.low) ||
            isNaN(item.close)
          );
          
          if (hasNulls) {
            console.warn(`❌ Found problematic data in ${key}, removing...`);
            localStorage.removeItem(key);
            clearedCount++;
          }
        } else {
          // Remove non-array cached data that might be corrupted
          localStorage.removeItem(key);
          clearedCount++;
        }
      }
    } catch (error) {
      console.warn(`❌ Error processing cache key ${key}:`, error);
      localStorage.removeItem(key);
      clearedCount++;
    }
  });
  
  console.log(`✅ Cleared ${clearedCount} problematic cache entries`);
  
  // Also clear any API cache
  try {
    if (window.apiCache) {
      window.apiCache.clear();
      console.log('✅ Cleared API cache');
    }
  } catch (error) {
    console.log('No API cache to clear');
  }
  
  return clearedCount;
}

// Auto-run on script load
clearCandlestickCache();

// Make available globally
window.clearCandlestickCache = clearCandlestickCache;

console.log('🛠️ Cache cleaner loaded. Run clearCandlestickCache() to clear problematic data');
