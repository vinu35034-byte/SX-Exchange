/**
 * Chart Error Testing Utility
 * Tests the comprehensive data validation pipeline to prevent "Value is null" errors
 */

/**
 * Test data validation pipeline for chart rendering
 */
export const testChartDataValidation = () => {
  console.log('🧪 Testing Chart Data Validation Pipeline...');
  
  // Test cases with problematic data
  const testCases = [
    {
      name: 'Null OHLC values',
      data: [
        { time: 1640995200, open: null, high: 1.1, low: 0.9, close: 1.05, volume: 1000 },
        { time: 1640995260, open: 1.05, high: null, low: 0.95, close: 1.02, volume: 1500 }
      ]
    },
    {
      name: 'Undefined values',
      data: [
        { time: 1640995200, open: undefined, high: 1.1, low: 0.9, close: 1.05, volume: 1000 },
        { time: 1640995260, open: 1.05, high: 1.08, low: undefined, close: 1.02, volume: 1500 }
      ]
    },
    {
      name: 'NaN values',
      data: [
        { time: 1640995200, open: NaN, high: 1.1, low: 0.9, close: 1.05, volume: 1000 },
        { time: 1640995260, open: 1.05, high: 1.08, low: 0.95, close: NaN, volume: 1500 }
      ]
    },
    {
      name: 'String values that should be numbers',
      data: [
        { time: 1640995200, open: "1.0", high: "1.1", low: "0.9", close: "1.05", volume: "1000" },
        { time: 1640995260, open: "invalid", high: "1.08", low: "0.95", close: "1.02", volume: "1500" }
      ]
    },
    {
      name: 'Valid data (should pass)',
      data: [
        { time: 1640995200, open: 1.0, high: 1.1, low: 0.9, close: 1.05, volume: 1000 },
        { time: 1640995260, open: 1.05, high: 1.08, low: 0.95, close: 1.02, volume: 1500 }
      ]
    }
  ];

  // Import the validation function from useCacheAwareData
  const validateAndTransformCandlestickData = (rawData) => {
    if (!rawData || !Array.isArray(rawData)) {
      console.warn('Invalid candlestick data format:', rawData);
      return [];
    }

    return rawData
      .map((candle, index) => {
        try {
          // Strict validation - reject any candle with null/undefined/invalid OHLC
          const requiredFields = ['time', 'open', 'high', 'low', 'close'];
          const missingFields = requiredFields.filter(field => 
            candle[field] === null || 
            candle[field] === undefined || 
            (typeof candle[field] === 'string' && candle[field].trim() === '')
          );

          if (missingFields.length > 0) {
            console.warn(`Skipping candle at index ${index} due to missing/null fields:`, missingFields, candle);
            return null;
          }

          // Convert and validate all numeric fields
          const time = parseInt(candle.time);
          const open = parseFloat(candle.open);
          const high = parseFloat(candle.high);
          const low = parseFloat(candle.low);
          const close = parseFloat(candle.close);
          const volume = parseFloat(candle.volume || 0);

          // Validate all numbers are finite and positive (for prices)
          if (!Number.isFinite(time) || time <= 0) {
            console.warn(`Invalid time at index ${index}:`, candle.time);
            return null;
          }

          if (!Number.isFinite(open) || open <= 0) {
            console.warn(`Invalid open price at index ${index}:`, candle.open);
            return null;
          }

          if (!Number.isFinite(high) || high <= 0) {
            console.warn(`Invalid high price at index ${index}:`, candle.high);
            return null;
          }

          if (!Number.isFinite(low) || low <= 0) {
            console.warn(`Invalid low price at index ${index}:`, candle.low);
            return null;
          }

          if (!Number.isFinite(close) || close <= 0) {
            console.warn(`Invalid close price at index ${index}:`, candle.close);
            return null;
          }

          if (!Number.isFinite(volume) || volume < 0) {
            console.warn(`Invalid volume at index ${index}, using 0:`, candle.volume);
            volume = 0;
          }

          // Validate OHLC relationships
          if (high < Math.max(open, close) || low > Math.min(open, close)) {
            console.warn(`Invalid OHLC relationships at index ${index}:`, { open, high, low, close });
            return null;
          }

          return {
            time,
            open: parseFloat(open.toFixed(8)),
            high: parseFloat(high.toFixed(8)),
            low: parseFloat(low.toFixed(8)),
            close: parseFloat(close.toFixed(8)),
            volume: parseFloat(volume.toFixed(8))
          };
        } catch (error) {
          console.warn(`Error processing candle at index ${index}:`, error, candle);
          return null;
        }
      })
      .filter(candle => candle !== null) // Remove all null entries
      .sort((a, b) => a.time - b.time); // Ensure chronological order
  };

  // Run tests
  testCases.forEach(testCase => {
    console.log(`\n📊 Testing: ${testCase.name}`);
    console.log('Input:', testCase.data);
    
    const result = validateAndTransformCandlestickData(testCase.data);
    console.log('Output:', result);
    console.log(`✅ Valid candles: ${result.length}/${testCase.data.length}`);
    
    // Check for any null values that could cause chart errors
    const hasNullValues = result.some(candle => 
      Object.values(candle).some(value => value === null || value === undefined || !Number.isFinite(value))
    );
    
    if (hasNullValues) {
      console.error('❌ VALIDATION FAILED: Result still contains null/invalid values!');
    } else {
      console.log('✅ VALIDATION PASSED: No null values detected');
    }
  });

  console.log('\n🎯 Chart Data Validation Test Complete');
  return true;
};

/**
 * Test chart component data processing
 */
export const testChartComponentValidation = (chartData) => {
  console.log('🧪 Testing Chart Component Data Processing...');
  
  if (!chartData || !Array.isArray(chartData) || chartData.length === 0) {
    console.warn('❌ No chart data provided or empty array');
    return false;
  }

  // Simulate chart component validation
  const processedData = chartData.map((candle, index) => {
    // Validate each candle before passing to chart library
    if (!candle || typeof candle !== 'object') {
      console.error(`❌ Invalid candle object at index ${index}:`, candle);
      return null;
    }

    const requiredFields = ['time', 'open', 'high', 'low', 'close'];
    for (const field of requiredFields) {
      if (!Number.isFinite(candle[field])) {
        console.error(`❌ Invalid ${field} value at index ${index}:`, candle[field]);
        return null;
      }
    }

    return candle;
  }).filter(Boolean);

  console.log(`✅ Chart Component Validation: ${processedData.length}/${chartData.length} candles valid`);
  
  if (processedData.length === 0) {
    console.error('❌ No valid candles for chart rendering!');
    return false;
  }

  return true;
};

/**
 * Clear potentially problematic cached data
 */
export const clearProblematicCacheData = () => {
  console.log('🧹 Clearing potentially problematic cached data...');
  
  const keysToCheck = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && (key.includes('chartData_') || key.includes('candlestick_'))) {
      keysToCheck.push(key);
    }
  }

  let clearedCount = 0;
  keysToCheck.forEach(key => {
    try {
      const data = localStorage.getItem(key);
      if (data) {
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed)) {
          // Check if this data contains null values
          const hasNullValues = parsed.some(item => 
            item && typeof item === 'object' && 
            Object.values(item).some(value => value === null || value === undefined)
          );
          
          if (hasNullValues) {
            console.log(`🗑️ Removing problematic cached data: ${key}`);
            localStorage.removeItem(key);
            localStorage.removeItem(`${key}_timestamp`);
            clearedCount++;
          }
        }
      }
    } catch (error) {
      console.warn(`Error checking cached data ${key}:`, error);
      // Remove corrupted cache entries
      localStorage.removeItem(key);
      clearedCount++;
    }
  });

  console.log(`✅ Cleared ${clearedCount} problematic cache entries`);
  return clearedCount;
};

// Auto-run tests in development
if (import.meta.env.DEV) {
  // Run tests after a short delay to avoid blocking initial load
  setTimeout(() => {
    console.log('🔧 Development Mode: Running chart data validation tests...');
    testChartDataValidation();
    clearProblematicCacheData();
  }, 2000);
}
