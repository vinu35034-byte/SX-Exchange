/**
 * Debug script for candlestick chart issues
 * Add this to browser console to monitor chart data
 */

function debugChartData() {
  console.log('🔍 Starting chart data monitor...');
  
  // Monitor console for chart errors
  const originalError = console.error;
  const originalWarn = console.warn;
  
  console.error = function(...args) {
    if (args[0] && args[0].toString().includes('Value is null')) {
      console.log('🚨 CHART NULL VALUE ERROR DETECTED!');
      console.log('Stack trace:', new Error().stack);
      
      // Try to find the problematic data
      try {
        console.log('Current chart data in localStorage:');
        const chartKeys = Object.keys(localStorage).filter(key => 
          key.includes('chart') || key.includes('candlestick') || key.includes('ATH')
        );
        
        chartKeys.forEach(key => {
          try {
            const data = JSON.parse(localStorage.getItem(key));
            if (Array.isArray(data)) {
              const nullItems = data.filter(item => 
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
              
              if (nullItems.length > 0) {
                console.error(`🚨 Found ${nullItems.length} problematic items in ${key}:`, nullItems);
              }
            }
          } catch (e) {
            console.warn(`Error checking ${key}:`, e);
          }
        });
      } catch (e) {
        console.error('Error in debug analysis:', e);
      }
    }
    
    originalError.apply(console, args);
  };
  
  console.warn = function(...args) {
    if (args[0] && args[0].toString().includes('CandlestickChart')) {
      console.log('📊 Chart validation warning:', args);
    }
    
    originalWarn.apply(console, args);
  };
  
  // Monitor API responses
  const originalFetch = window.fetch;
  window.fetch = function(...args) {
    const url = args[0];
    
    if (url && url.includes('candlesticks')) {
      console.log('🔍 Monitoring candlestick API call:', url);
      
      return originalFetch.apply(this, args).then(response => {
        return response.clone().json().then(data => {
          if (data.success && data.data) {
            const nullCandles = data.data.filter(candle => 
              !candle ||
              candle.open === null ||
              candle.high === null ||
              candle.low === null ||
              candle.close === null ||
              isNaN(candle.open) ||
              isNaN(candle.high) ||
              isNaN(candle.low) ||
              isNaN(candle.close)
            );
            
            if (nullCandles.length > 0) {
              console.error('🚨 API returned candles with null values:', {
                url,
                totalCandles: data.data.length,
                nullCandles: nullCandles.length,
                samples: nullCandles.slice(0, 3)
              });
            } else {
              console.log('✅ API returned valid candles:', {
                url,
                totalCandles: data.data.length,
                sampleCandle: data.data[0]
              });
            }
          }
          
          return response;
        }).catch(() => response);
      });
    }
    
    return originalFetch.apply(this, args);
  };
  
  console.log('✅ Chart data monitor active');
  
  return {
    stop: () => {
      console.error = originalError;
      console.warn = originalWarn;
      window.fetch = originalFetch;
      console.log('🛑 Chart data monitor stopped');
    }
  };
}

// Auto-start monitoring
window.chartDebugMonitor = debugChartData();

console.log('🛠️ Chart debugger loaded. Access via window.chartDebugMonitor');
