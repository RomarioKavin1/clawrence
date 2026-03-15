const { formatUnits, parseUnits } = require('viem');
console.log(parseFloat(formatUnits(undefined, 18)).toFixed(6));
