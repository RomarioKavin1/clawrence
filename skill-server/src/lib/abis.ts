export const VAULT_ABI = [
  { name: 'getHealthFactor',       type: 'function', stateMutability: 'view', inputs: [{ name: 'agent', type: 'address' }], outputs: [{ name: '', type: 'uint256' }] },
  { name: 'getMaxBorrow',          type: 'function', stateMutability: 'view', inputs: [{ name: 'agent', type: 'address' }], outputs: [{ name: '', type: 'uint256' }] },
  { name: 'getCollateralValueUSD', type: 'function', stateMutability: 'view', inputs: [{ name: 'agent', type: 'address' }], outputs: [{ name: '', type: 'uint256' }] },
  { name: 'collateral',            type: 'function', stateMutability: 'view', inputs: [{ name: '', type: 'address' }],      outputs: [{ name: '', type: 'uint256' }] },
  { name: 'debt',                  type: 'function', stateMutability: 'view', inputs: [{ name: '', type: 'address' }],      outputs: [{ name: '', type: 'uint256' }] },
  { name: 'loanTimestamp',         type: 'function', stateMutability: 'view', inputs: [{ name: '', type: 'address' }],      outputs: [{ name: '', type: 'uint256' }] },
  { name: 'lastLoanTime',          type: 'function', stateMutability: 'view', inputs: [{ name: '', type: 'address' }],      outputs: [{ name: '', type: 'uint256' }] },
  { name: 'maxBorrowAtLoan',       type: 'function', stateMutability: 'view', inputs: [{ name: '', type: 'address' }],      outputs: [{ name: '', type: 'uint256' }] },
  { name: 'setPrice',              type: 'function', stateMutability: 'nonpayable', inputs: [{ name: '_price', type: 'uint256' }, { name: '_timestamp', type: 'uint256' }], outputs: [] },
  { name: 'depositFor',           type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'user', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [] },
] as const

export const CREDIT_SCORE_ABI = [
  { name: 'getScore',              type: 'function', stateMutability: 'view', inputs: [{ name: 'agent', type: 'address' }], outputs: [{ name: '', type: 'uint256' }] },
  { name: 'getLTV',                type: 'function', stateMutability: 'view', inputs: [{ name: 'agent', type: 'address' }], outputs: [{ name: '', type: 'uint256' }] },
  { name: 'consecutiveRepayments', type: 'function', stateMutability: 'view', inputs: [{ name: '', type: 'address' }],      outputs: [{ name: '', type: 'uint256' }] },
  { name: 'lastActivityTimestamp', type: 'function', stateMutability: 'view', inputs: [{ name: '', type: 'address' }],      outputs: [{ name: '', type: 'uint256' }] },
  { name: 'totalLoans',            type: 'function', stateMutability: 'view', inputs: [{ name: '', type: 'address' }],      outputs: [{ name: '', type: 'uint256' }] },
  { name: 'totalRepaid',           type: 'function', stateMutability: 'view', inputs: [{ name: '', type: 'address' }],      outputs: [{ name: '', type: 'uint256' }] },
  { name: 'hasHistory',            type: 'function', stateMutability: 'view', inputs: [{ name: '', type: 'address' }],      outputs: [{ name: '', type: 'bool' }] },
] as const

export const ERC20_ABI = [
  { name: 'balanceOf',  type: 'function', stateMutability: 'view', inputs: [{ name: 'account', type: 'address' }], outputs: [{ name: '', type: 'uint256' }] },
] as const

export const DIA_ORACLE_ABI = [
  { name: 'getValue', type: 'function', stateMutability: 'view', inputs: [{ name: 'key', type: 'string' }], outputs: [{ name: 'price', type: 'uint128' }, { name: 'timestamp', type: 'uint128' }] },
] as const
