export const VAULT_ADDRESS = (process.env.NEXT_PUBLIC_VAULT_ADDRESS || '0x0000000000000000000000000000000000000000') as `0x${string}`
export const CREDIT_SCORE_ADDRESS = (process.env.NEXT_PUBLIC_CREDIT_SCORE_ADDRESS || '0x0000000000000000000000000000000000000000') as `0x${string}`
export const USDC_ADDRESS = '0x29d1ee93e9ecf6e50f309f498e40a6b42d352fa1' as const

export const VAULT_ABI = [
  { name: 'getHealthFactor',       type: 'function', stateMutability: 'view',        inputs: [{ name: 'agent', type: 'address' }], outputs: [{ type: 'uint256' }] },
  { name: 'getMaxBorrow',          type: 'function', stateMutability: 'view',        inputs: [{ name: 'agent', type: 'address' }], outputs: [{ type: 'uint256' }] },
  { name: 'getCollateralValueUSD', type: 'function', stateMutability: 'view',        inputs: [{ name: 'agent', type: 'address' }], outputs: [{ type: 'uint256' }] },
  { name: 'collateral',            type: 'function', stateMutability: 'view',        inputs: [{ name: '', type: 'address' }],      outputs: [{ type: 'uint256' }] },
  { name: 'debt',                  type: 'function', stateMutability: 'view',        inputs: [{ name: '', type: 'address' }],      outputs: [{ type: 'uint256' }] },
  { name: 'deposit',               type: 'function', stateMutability: 'payable',     inputs: [],                                                                                outputs: [] },
  { name: 'borrow',                type: 'function', stateMutability: 'nonpayable',  inputs: [{ name: 'recipient', type: 'address' }, { name: 'amount', type: 'uint256' }],  outputs: [] },
  { name: 'repay',                 type: 'function', stateMutability: 'nonpayable',  inputs: [{ name: 'onBehalfOf', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [] },
  { name: 'withdraw',              type: 'function', stateMutability: 'nonpayable',  inputs: [{ name: 'amount', type: 'uint256' }],                                           outputs: [] },
] as const

export const CREDIT_SCORE_ABI = [
  { name: 'getScore',                type: 'function', stateMutability: 'view', inputs: [{ name: 'agent', type: 'address' }], outputs: [{ type: 'uint256' }] },
  { name: 'getLTV',                  type: 'function', stateMutability: 'view', inputs: [{ name: 'agent', type: 'address' }], outputs: [{ type: 'uint256' }] },
  { name: 'consecutiveRepayments',   type: 'function', stateMutability: 'view', inputs: [{ name: '', type: 'address' }],      outputs: [{ type: 'uint256' }] },
  { name: 'totalLoans',              type: 'function', stateMutability: 'view', inputs: [{ name: '', type: 'address' }],      outputs: [{ type: 'uint256' }] },
  { name: 'totalRepaid',             type: 'function', stateMutability: 'view', inputs: [{ name: '', type: 'address' }],      outputs: [{ type: 'uint256' }] },
] as const

export const ERC20_ABI = [
  { name: 'approve',   type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ type: 'bool' }] },
  { name: 'allowance', type: 'function', stateMutability: 'view',       inputs: [{ name: 'owner', type: 'address' }, { name: 'spender', type: 'address' }],  outputs: [{ type: 'uint256' }] },
  { name: 'balanceOf', type: 'function', stateMutability: 'view',       inputs: [{ name: 'account', type: 'address' }], outputs: [{ type: 'uint256' }] },
] as const
