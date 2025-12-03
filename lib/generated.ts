import {
  createUseReadContract,
  createUseWriteContract,
  createUseSimulateContract,
  createUseWatchContractEvent,
} from 'wagmi/codegen'

import {
  createReadContract,
  createWriteContract,
  createSimulateContract,
  createWatchContractEvent,
} from 'wagmi/codegen'

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// ContextRouter
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

/**
 * - [__View Contract on Base Basescan__](https://basescan.org/address/0x676645eF4d3133181572622DABFaeC2170Db670B)
 * - [__View Contract on Base Sepolia Basescan__](https://sepolia.basescan.org/address/0x676645eF4d3133181572622DABFaeC2170Db670B)
 */
export const contextRouterAbi = [
  {
    type: 'constructor',
    inputs: [
      { name: '_usdcAddress', internalType: 'address', type: 'address' },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'error',
    inputs: [{ name: 'owner', internalType: 'address', type: 'address' }],
    name: 'OwnableInvalidOwner',
  },
  {
    type: 'error',
    inputs: [{ name: 'account', internalType: 'address', type: 'address' }],
    name: 'OwnableUnauthorizedAccount',
  },
  { type: 'error', inputs: [], name: 'ReentrancyGuardReentrantCall' },
  {
    type: 'error',
    inputs: [{ name: 'token', internalType: 'address', type: 'address' }],
    name: 'SafeERC20FailedOperation',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'developer',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
      {
        name: 'amount',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false,
      },
    ],
    name: 'EarningsClaimed',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      { name: 'user', internalType: 'address', type: 'address', indexed: true },
      {
        name: 'amount',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false,
      },
    ],
    name: 'ModelCostPaid',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'operator',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
    ],
    name: 'OperatorAdded',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'operator',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
    ],
    name: 'OperatorRemoved',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'previousOwner',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
      {
        name: 'newOwner',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
    ],
    name: 'OwnershipTransferred',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'platform',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
      {
        name: 'amount',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false,
      },
    ],
    name: 'PlatformFeesClaimed',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'toolId',
        internalType: 'uint256',
        type: 'uint256',
        indexed: true,
      },
      { name: 'user', internalType: 'address', type: 'address', indexed: true },
      {
        name: 'developer',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
      {
        name: 'amount',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false,
      },
      {
        name: 'platformFee',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false,
      },
    ],
    name: 'QueryPaid',
  },
  {
    type: 'function',
    inputs: [],
    name: 'PLATFORM_FEE_PERCENT',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [{ name: 'operator', internalType: 'address', type: 'address' }],
    name: 'addOperator',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [],
    name: 'claimEarnings',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [],
    name: 'claimPlatformFees',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [{ name: '', internalType: 'address', type: 'address' }],
    name: 'developerBalances',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [
      { name: 'toolIds', internalType: 'uint256[]', type: 'uint256[]' },
      {
        name: 'developerWallets',
        internalType: 'address[]',
        type: 'address[]',
      },
      { name: 'amounts', internalType: 'uint256[]', type: 'uint256[]' },
    ],
    name: 'executeBatchPaidQuery',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      { name: 'user', internalType: 'address', type: 'address' },
      { name: 'toolIds', internalType: 'uint256[]', type: 'uint256[]' },
      {
        name: 'developerWallets',
        internalType: 'address[]',
        type: 'address[]',
      },
      { name: 'amounts', internalType: 'uint256[]', type: 'uint256[]' },
    ],
    name: 'executeBatchPaidQueryFor',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      { name: 'toolId', internalType: 'uint256', type: 'uint256' },
      { name: 'developerWallet', internalType: 'address', type: 'address' },
      { name: 'amount', internalType: 'uint256', type: 'uint256' },
    ],
    name: 'executePaidQuery',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      { name: 'user', internalType: 'address', type: 'address' },
      { name: 'toolId', internalType: 'uint256', type: 'uint256' },
      { name: 'developerWallet', internalType: 'address', type: 'address' },
      { name: 'amount', internalType: 'uint256', type: 'uint256' },
    ],
    name: 'executePaidQueryFor',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      { name: 'toolId', internalType: 'uint256', type: 'uint256' },
      { name: 'developerWallet', internalType: 'address', type: 'address' },
      { name: 'toolAmount', internalType: 'uint256', type: 'uint256' },
      { name: 'modelCost', internalType: 'uint256', type: 'uint256' },
    ],
    name: 'executeQueryWithModelCost',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      { name: 'user', internalType: 'address', type: 'address' },
      { name: 'toolId', internalType: 'uint256', type: 'uint256' },
      { name: 'developerWallet', internalType: 'address', type: 'address' },
      { name: 'toolAmount', internalType: 'uint256', type: 'uint256' },
      { name: 'modelCost', internalType: 'uint256', type: 'uint256' },
    ],
    name: 'executeQueryWithModelCostFor',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [],
    name: 'getPlatformBalance',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [{ name: 'developer', internalType: 'address', type: 'address' }],
    name: 'getUnclaimedBalance',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [{ name: 'operator', internalType: 'address', type: 'address' }],
    name: 'isOperator',
    outputs: [{ name: '', internalType: 'bool', type: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [{ name: '', internalType: 'address', type: 'address' }],
    name: 'operators',
    outputs: [{ name: '', internalType: 'bool', type: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'owner',
    outputs: [{ name: '', internalType: 'address', type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'platformBalance',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [{ name: 'operator', internalType: 'address', type: 'address' }],
    name: 'removeOperator',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [],
    name: 'renounceOwnership',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [{ name: 'newOwner', internalType: 'address', type: 'address' }],
    name: 'transferOwnership',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [],
    name: 'usdc',
    outputs: [{ name: '', internalType: 'contract IERC20', type: 'address' }],
    stateMutability: 'view',
  },
] as const

/**
 * - [__View Contract on Base Basescan__](https://basescan.org/address/0x676645eF4d3133181572622DABFaeC2170Db670B)
 * - [__View Contract on Base Sepolia Basescan__](https://sepolia.basescan.org/address/0x676645eF4d3133181572622DABFaeC2170Db670B)
 */
export const contextRouterAddress = {
  8453: '0x676645eF4d3133181572622DABFaeC2170Db670B',
  84532: '0x676645eF4d3133181572622DABFaeC2170Db670B',
} as const

/**
 * - [__View Contract on Base Basescan__](https://basescan.org/address/0x676645eF4d3133181572622DABFaeC2170Db670B)
 * - [__View Contract on Base Sepolia Basescan__](https://sepolia.basescan.org/address/0x676645eF4d3133181572622DABFaeC2170Db670B)
 */
export const contextRouterConfig = {
  address: contextRouterAddress,
  abi: contextRouterAbi,
} as const

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// ERC20
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

export const erc20Abi = [
  {
    type: 'error',
    inputs: [
      { name: 'spender', internalType: 'address', type: 'address' },
      { name: 'allowance', internalType: 'uint256', type: 'uint256' },
      { name: 'needed', internalType: 'uint256', type: 'uint256' },
    ],
    name: 'ERC20InsufficientAllowance',
  },
  {
    type: 'error',
    inputs: [
      { name: 'sender', internalType: 'address', type: 'address' },
      { name: 'balance', internalType: 'uint256', type: 'uint256' },
      { name: 'needed', internalType: 'uint256', type: 'uint256' },
    ],
    name: 'ERC20InsufficientBalance',
  },
  {
    type: 'error',
    inputs: [{ name: 'approver', internalType: 'address', type: 'address' }],
    name: 'ERC20InvalidApprover',
  },
  {
    type: 'error',
    inputs: [{ name: 'receiver', internalType: 'address', type: 'address' }],
    name: 'ERC20InvalidReceiver',
  },
  {
    type: 'error',
    inputs: [{ name: 'sender', internalType: 'address', type: 'address' }],
    name: 'ERC20InvalidSender',
  },
  {
    type: 'error',
    inputs: [{ name: 'spender', internalType: 'address', type: 'address' }],
    name: 'ERC20InvalidSpender',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'owner',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
      {
        name: 'spender',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
      {
        name: 'value',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false,
      },
    ],
    name: 'Approval',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      { name: 'from', internalType: 'address', type: 'address', indexed: true },
      { name: 'to', internalType: 'address', type: 'address', indexed: true },
      {
        name: 'value',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false,
      },
    ],
    name: 'Transfer',
  },
  {
    type: 'function',
    inputs: [
      { name: 'owner', internalType: 'address', type: 'address' },
      { name: 'spender', internalType: 'address', type: 'address' },
    ],
    name: 'allowance',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [
      { name: 'spender', internalType: 'address', type: 'address' },
      { name: 'value', internalType: 'uint256', type: 'uint256' },
    ],
    name: 'approve',
    outputs: [{ name: '', internalType: 'bool', type: 'bool' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [{ name: 'account', internalType: 'address', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'decimals',
    outputs: [{ name: '', internalType: 'uint8', type: 'uint8' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'name',
    outputs: [{ name: '', internalType: 'string', type: 'string' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'symbol',
    outputs: [{ name: '', internalType: 'string', type: 'string' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'totalSupply',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [
      { name: 'to', internalType: 'address', type: 'address' },
      { name: 'value', internalType: 'uint256', type: 'uint256' },
    ],
    name: 'transfer',
    outputs: [{ name: '', internalType: 'bool', type: 'bool' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      { name: 'from', internalType: 'address', type: 'address' },
      { name: 'to', internalType: 'address', type: 'address' },
      { name: 'value', internalType: 'uint256', type: 'uint256' },
    ],
    name: 'transferFrom',
    outputs: [{ name: '', internalType: 'bool', type: 'bool' }],
    stateMutability: 'nonpayable',
  },
] as const

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// IERC1155Errors
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

export const ierc1155ErrorsAbi = [
  {
    type: 'error',
    inputs: [
      { name: 'sender', internalType: 'address', type: 'address' },
      { name: 'balance', internalType: 'uint256', type: 'uint256' },
      { name: 'needed', internalType: 'uint256', type: 'uint256' },
      { name: 'tokenId', internalType: 'uint256', type: 'uint256' },
    ],
    name: 'ERC1155InsufficientBalance',
  },
  {
    type: 'error',
    inputs: [{ name: 'approver', internalType: 'address', type: 'address' }],
    name: 'ERC1155InvalidApprover',
  },
  {
    type: 'error',
    inputs: [
      { name: 'idsLength', internalType: 'uint256', type: 'uint256' },
      { name: 'valuesLength', internalType: 'uint256', type: 'uint256' },
    ],
    name: 'ERC1155InvalidArrayLength',
  },
  {
    type: 'error',
    inputs: [{ name: 'operator', internalType: 'address', type: 'address' }],
    name: 'ERC1155InvalidOperator',
  },
  {
    type: 'error',
    inputs: [{ name: 'receiver', internalType: 'address', type: 'address' }],
    name: 'ERC1155InvalidReceiver',
  },
  {
    type: 'error',
    inputs: [{ name: 'sender', internalType: 'address', type: 'address' }],
    name: 'ERC1155InvalidSender',
  },
  {
    type: 'error',
    inputs: [
      { name: 'operator', internalType: 'address', type: 'address' },
      { name: 'owner', internalType: 'address', type: 'address' },
    ],
    name: 'ERC1155MissingApprovalForAll',
  },
] as const

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// IERC1363
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

export const ierc1363Abi = [
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'owner',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
      {
        name: 'spender',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
      {
        name: 'value',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false,
      },
    ],
    name: 'Approval',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      { name: 'from', internalType: 'address', type: 'address', indexed: true },
      { name: 'to', internalType: 'address', type: 'address', indexed: true },
      {
        name: 'value',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false,
      },
    ],
    name: 'Transfer',
  },
  {
    type: 'function',
    inputs: [
      { name: 'owner', internalType: 'address', type: 'address' },
      { name: 'spender', internalType: 'address', type: 'address' },
    ],
    name: 'allowance',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [
      { name: 'spender', internalType: 'address', type: 'address' },
      { name: 'value', internalType: 'uint256', type: 'uint256' },
    ],
    name: 'approve',
    outputs: [{ name: '', internalType: 'bool', type: 'bool' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      { name: 'spender', internalType: 'address', type: 'address' },
      { name: 'value', internalType: 'uint256', type: 'uint256' },
    ],
    name: 'approveAndCall',
    outputs: [{ name: '', internalType: 'bool', type: 'bool' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      { name: 'spender', internalType: 'address', type: 'address' },
      { name: 'value', internalType: 'uint256', type: 'uint256' },
      { name: 'data', internalType: 'bytes', type: 'bytes' },
    ],
    name: 'approveAndCall',
    outputs: [{ name: '', internalType: 'bool', type: 'bool' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [{ name: 'account', internalType: 'address', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [{ name: 'interfaceId', internalType: 'bytes4', type: 'bytes4' }],
    name: 'supportsInterface',
    outputs: [{ name: '', internalType: 'bool', type: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'totalSupply',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [
      { name: 'to', internalType: 'address', type: 'address' },
      { name: 'value', internalType: 'uint256', type: 'uint256' },
    ],
    name: 'transfer',
    outputs: [{ name: '', internalType: 'bool', type: 'bool' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      { name: 'to', internalType: 'address', type: 'address' },
      { name: 'value', internalType: 'uint256', type: 'uint256' },
    ],
    name: 'transferAndCall',
    outputs: [{ name: '', internalType: 'bool', type: 'bool' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      { name: 'to', internalType: 'address', type: 'address' },
      { name: 'value', internalType: 'uint256', type: 'uint256' },
      { name: 'data', internalType: 'bytes', type: 'bytes' },
    ],
    name: 'transferAndCall',
    outputs: [{ name: '', internalType: 'bool', type: 'bool' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      { name: 'from', internalType: 'address', type: 'address' },
      { name: 'to', internalType: 'address', type: 'address' },
      { name: 'value', internalType: 'uint256', type: 'uint256' },
    ],
    name: 'transferFrom',
    outputs: [{ name: '', internalType: 'bool', type: 'bool' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      { name: 'from', internalType: 'address', type: 'address' },
      { name: 'to', internalType: 'address', type: 'address' },
      { name: 'value', internalType: 'uint256', type: 'uint256' },
      { name: 'data', internalType: 'bytes', type: 'bytes' },
    ],
    name: 'transferFromAndCall',
    outputs: [{ name: '', internalType: 'bool', type: 'bool' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      { name: 'from', internalType: 'address', type: 'address' },
      { name: 'to', internalType: 'address', type: 'address' },
      { name: 'value', internalType: 'uint256', type: 'uint256' },
    ],
    name: 'transferFromAndCall',
    outputs: [{ name: '', internalType: 'bool', type: 'bool' }],
    stateMutability: 'nonpayable',
  },
] as const

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// IERC165
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

export const ierc165Abi = [
  {
    type: 'function',
    inputs: [{ name: 'interfaceId', internalType: 'bytes4', type: 'bytes4' }],
    name: 'supportsInterface',
    outputs: [{ name: '', internalType: 'bool', type: 'bool' }],
    stateMutability: 'view',
  },
] as const

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// IERC20
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

export const ierc20Abi = [
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'owner',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
      {
        name: 'spender',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
      {
        name: 'value',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false,
      },
    ],
    name: 'Approval',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      { name: 'from', internalType: 'address', type: 'address', indexed: true },
      { name: 'to', internalType: 'address', type: 'address', indexed: true },
      {
        name: 'value',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false,
      },
    ],
    name: 'Transfer',
  },
  {
    type: 'function',
    inputs: [
      { name: 'owner', internalType: 'address', type: 'address' },
      { name: 'spender', internalType: 'address', type: 'address' },
    ],
    name: 'allowance',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [
      { name: 'spender', internalType: 'address', type: 'address' },
      { name: 'value', internalType: 'uint256', type: 'uint256' },
    ],
    name: 'approve',
    outputs: [{ name: '', internalType: 'bool', type: 'bool' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [{ name: 'account', internalType: 'address', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'totalSupply',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [
      { name: 'to', internalType: 'address', type: 'address' },
      { name: 'value', internalType: 'uint256', type: 'uint256' },
    ],
    name: 'transfer',
    outputs: [{ name: '', internalType: 'bool', type: 'bool' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      { name: 'from', internalType: 'address', type: 'address' },
      { name: 'to', internalType: 'address', type: 'address' },
      { name: 'value', internalType: 'uint256', type: 'uint256' },
    ],
    name: 'transferFrom',
    outputs: [{ name: '', internalType: 'bool', type: 'bool' }],
    stateMutability: 'nonpayable',
  },
] as const

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// IERC20Errors
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

export const ierc20ErrorsAbi = [
  {
    type: 'error',
    inputs: [
      { name: 'spender', internalType: 'address', type: 'address' },
      { name: 'allowance', internalType: 'uint256', type: 'uint256' },
      { name: 'needed', internalType: 'uint256', type: 'uint256' },
    ],
    name: 'ERC20InsufficientAllowance',
  },
  {
    type: 'error',
    inputs: [
      { name: 'sender', internalType: 'address', type: 'address' },
      { name: 'balance', internalType: 'uint256', type: 'uint256' },
      { name: 'needed', internalType: 'uint256', type: 'uint256' },
    ],
    name: 'ERC20InsufficientBalance',
  },
  {
    type: 'error',
    inputs: [{ name: 'approver', internalType: 'address', type: 'address' }],
    name: 'ERC20InvalidApprover',
  },
  {
    type: 'error',
    inputs: [{ name: 'receiver', internalType: 'address', type: 'address' }],
    name: 'ERC20InvalidReceiver',
  },
  {
    type: 'error',
    inputs: [{ name: 'sender', internalType: 'address', type: 'address' }],
    name: 'ERC20InvalidSender',
  },
  {
    type: 'error',
    inputs: [{ name: 'spender', internalType: 'address', type: 'address' }],
    name: 'ERC20InvalidSpender',
  },
] as const

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// IERC20Metadata
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

export const ierc20MetadataAbi = [
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'owner',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
      {
        name: 'spender',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
      {
        name: 'value',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false,
      },
    ],
    name: 'Approval',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      { name: 'from', internalType: 'address', type: 'address', indexed: true },
      { name: 'to', internalType: 'address', type: 'address', indexed: true },
      {
        name: 'value',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false,
      },
    ],
    name: 'Transfer',
  },
  {
    type: 'function',
    inputs: [
      { name: 'owner', internalType: 'address', type: 'address' },
      { name: 'spender', internalType: 'address', type: 'address' },
    ],
    name: 'allowance',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [
      { name: 'spender', internalType: 'address', type: 'address' },
      { name: 'value', internalType: 'uint256', type: 'uint256' },
    ],
    name: 'approve',
    outputs: [{ name: '', internalType: 'bool', type: 'bool' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [{ name: 'account', internalType: 'address', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'decimals',
    outputs: [{ name: '', internalType: 'uint8', type: 'uint8' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'name',
    outputs: [{ name: '', internalType: 'string', type: 'string' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'symbol',
    outputs: [{ name: '', internalType: 'string', type: 'string' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'totalSupply',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [
      { name: 'to', internalType: 'address', type: 'address' },
      { name: 'value', internalType: 'uint256', type: 'uint256' },
    ],
    name: 'transfer',
    outputs: [{ name: '', internalType: 'bool', type: 'bool' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      { name: 'from', internalType: 'address', type: 'address' },
      { name: 'to', internalType: 'address', type: 'address' },
      { name: 'value', internalType: 'uint256', type: 'uint256' },
    ],
    name: 'transferFrom',
    outputs: [{ name: '', internalType: 'bool', type: 'bool' }],
    stateMutability: 'nonpayable',
  },
] as const

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// IERC721Errors
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

export const ierc721ErrorsAbi = [
  {
    type: 'error',
    inputs: [
      { name: 'sender', internalType: 'address', type: 'address' },
      { name: 'tokenId', internalType: 'uint256', type: 'uint256' },
      { name: 'owner', internalType: 'address', type: 'address' },
    ],
    name: 'ERC721IncorrectOwner',
  },
  {
    type: 'error',
    inputs: [
      { name: 'operator', internalType: 'address', type: 'address' },
      { name: 'tokenId', internalType: 'uint256', type: 'uint256' },
    ],
    name: 'ERC721InsufficientApproval',
  },
  {
    type: 'error',
    inputs: [{ name: 'approver', internalType: 'address', type: 'address' }],
    name: 'ERC721InvalidApprover',
  },
  {
    type: 'error',
    inputs: [{ name: 'operator', internalType: 'address', type: 'address' }],
    name: 'ERC721InvalidOperator',
  },
  {
    type: 'error',
    inputs: [{ name: 'owner', internalType: 'address', type: 'address' }],
    name: 'ERC721InvalidOwner',
  },
  {
    type: 'error',
    inputs: [{ name: 'receiver', internalType: 'address', type: 'address' }],
    name: 'ERC721InvalidReceiver',
  },
  {
    type: 'error',
    inputs: [{ name: 'sender', internalType: 'address', type: 'address' }],
    name: 'ERC721InvalidSender',
  },
  {
    type: 'error',
    inputs: [{ name: 'tokenId', internalType: 'uint256', type: 'uint256' }],
    name: 'ERC721NonexistentToken',
  },
] as const

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// MockERC20
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

export const mockErc20Abi = [
  {
    type: 'constructor',
    inputs: [
      { name: 'name', internalType: 'string', type: 'string' },
      { name: 'symbol', internalType: 'string', type: 'string' },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'error',
    inputs: [
      { name: 'spender', internalType: 'address', type: 'address' },
      { name: 'allowance', internalType: 'uint256', type: 'uint256' },
      { name: 'needed', internalType: 'uint256', type: 'uint256' },
    ],
    name: 'ERC20InsufficientAllowance',
  },
  {
    type: 'error',
    inputs: [
      { name: 'sender', internalType: 'address', type: 'address' },
      { name: 'balance', internalType: 'uint256', type: 'uint256' },
      { name: 'needed', internalType: 'uint256', type: 'uint256' },
    ],
    name: 'ERC20InsufficientBalance',
  },
  {
    type: 'error',
    inputs: [{ name: 'approver', internalType: 'address', type: 'address' }],
    name: 'ERC20InvalidApprover',
  },
  {
    type: 'error',
    inputs: [{ name: 'receiver', internalType: 'address', type: 'address' }],
    name: 'ERC20InvalidReceiver',
  },
  {
    type: 'error',
    inputs: [{ name: 'sender', internalType: 'address', type: 'address' }],
    name: 'ERC20InvalidSender',
  },
  {
    type: 'error',
    inputs: [{ name: 'spender', internalType: 'address', type: 'address' }],
    name: 'ERC20InvalidSpender',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'owner',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
      {
        name: 'spender',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
      {
        name: 'value',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false,
      },
    ],
    name: 'Approval',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      { name: 'from', internalType: 'address', type: 'address', indexed: true },
      { name: 'to', internalType: 'address', type: 'address', indexed: true },
      {
        name: 'value',
        internalType: 'uint256',
        type: 'uint256',
        indexed: false,
      },
    ],
    name: 'Transfer',
  },
  {
    type: 'function',
    inputs: [
      { name: 'owner', internalType: 'address', type: 'address' },
      { name: 'spender', internalType: 'address', type: 'address' },
    ],
    name: 'allowance',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [
      { name: 'spender', internalType: 'address', type: 'address' },
      { name: 'value', internalType: 'uint256', type: 'uint256' },
    ],
    name: 'approve',
    outputs: [{ name: '', internalType: 'bool', type: 'bool' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [{ name: 'account', internalType: 'address', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'decimals',
    outputs: [{ name: '', internalType: 'uint8', type: 'uint8' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [
      { name: 'to', internalType: 'address', type: 'address' },
      { name: 'amount', internalType: 'uint256', type: 'uint256' },
    ],
    name: 'mint',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [],
    name: 'name',
    outputs: [{ name: '', internalType: 'string', type: 'string' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'symbol',
    outputs: [{ name: '', internalType: 'string', type: 'string' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'totalSupply',
    outputs: [{ name: '', internalType: 'uint256', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [
      { name: 'to', internalType: 'address', type: 'address' },
      { name: 'value', internalType: 'uint256', type: 'uint256' },
    ],
    name: 'transfer',
    outputs: [{ name: '', internalType: 'bool', type: 'bool' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [
      { name: 'from', internalType: 'address', type: 'address' },
      { name: 'to', internalType: 'address', type: 'address' },
      { name: 'value', internalType: 'uint256', type: 'uint256' },
    ],
    name: 'transferFrom',
    outputs: [{ name: '', internalType: 'bool', type: 'bool' }],
    stateMutability: 'nonpayable',
  },
] as const

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Ownable
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

export const ownableAbi = [
  {
    type: 'error',
    inputs: [{ name: 'owner', internalType: 'address', type: 'address' }],
    name: 'OwnableInvalidOwner',
  },
  {
    type: 'error',
    inputs: [{ name: 'account', internalType: 'address', type: 'address' }],
    name: 'OwnableUnauthorizedAccount',
  },
  {
    type: 'event',
    anonymous: false,
    inputs: [
      {
        name: 'previousOwner',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
      {
        name: 'newOwner',
        internalType: 'address',
        type: 'address',
        indexed: true,
      },
    ],
    name: 'OwnershipTransferred',
  },
  {
    type: 'function',
    inputs: [],
    name: 'owner',
    outputs: [{ name: '', internalType: 'address', type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [],
    name: 'renounceOwnership',
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    inputs: [{ name: 'newOwner', internalType: 'address', type: 'address' }],
    name: 'transferOwnership',
    outputs: [],
    stateMutability: 'nonpayable',
  },
] as const

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// ReentrancyGuard
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

export const reentrancyGuardAbi = [
  { type: 'error', inputs: [], name: 'ReentrancyGuardReentrantCall' },
] as const

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// SafeERC20
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

export const safeErc20Abi = [
  {
    type: 'error',
    inputs: [
      { name: 'spender', internalType: 'address', type: 'address' },
      { name: 'currentAllowance', internalType: 'uint256', type: 'uint256' },
      { name: 'requestedDecrease', internalType: 'uint256', type: 'uint256' },
    ],
    name: 'SafeERC20FailedDecreaseAllowance',
  },
  {
    type: 'error',
    inputs: [{ name: 'token', internalType: 'address', type: 'address' }],
    name: 'SafeERC20FailedOperation',
  },
] as const

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// React
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link contextRouterAbi}__
 *
 * - [__View Contract on Base Basescan__](https://basescan.org/address/0x676645eF4d3133181572622DABFaeC2170Db670B)
 * - [__View Contract on Base Sepolia Basescan__](https://sepolia.basescan.org/address/0x676645eF4d3133181572622DABFaeC2170Db670B)
 */
export const useReadContextRouter = /*#__PURE__*/ createUseReadContract({
  abi: contextRouterAbi,
  address: contextRouterAddress,
})

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link contextRouterAbi}__ and `functionName` set to `"PLATFORM_FEE_PERCENT"`
 *
 * - [__View Contract on Base Basescan__](https://basescan.org/address/0x676645eF4d3133181572622DABFaeC2170Db670B)
 * - [__View Contract on Base Sepolia Basescan__](https://sepolia.basescan.org/address/0x676645eF4d3133181572622DABFaeC2170Db670B)
 */
export const useReadContextRouterPlatformFeePercent =
  /*#__PURE__*/ createUseReadContract({
    abi: contextRouterAbi,
    address: contextRouterAddress,
    functionName: 'PLATFORM_FEE_PERCENT',
  })

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link contextRouterAbi}__ and `functionName` set to `"developerBalances"`
 *
 * - [__View Contract on Base Basescan__](https://basescan.org/address/0x676645eF4d3133181572622DABFaeC2170Db670B)
 * - [__View Contract on Base Sepolia Basescan__](https://sepolia.basescan.org/address/0x676645eF4d3133181572622DABFaeC2170Db670B)
 */
export const useReadContextRouterDeveloperBalances =
  /*#__PURE__*/ createUseReadContract({
    abi: contextRouterAbi,
    address: contextRouterAddress,
    functionName: 'developerBalances',
  })

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link contextRouterAbi}__ and `functionName` set to `"getPlatformBalance"`
 *
 * - [__View Contract on Base Basescan__](https://basescan.org/address/0x676645eF4d3133181572622DABFaeC2170Db670B)
 * - [__View Contract on Base Sepolia Basescan__](https://sepolia.basescan.org/address/0x676645eF4d3133181572622DABFaeC2170Db670B)
 */
export const useReadContextRouterGetPlatformBalance =
  /*#__PURE__*/ createUseReadContract({
    abi: contextRouterAbi,
    address: contextRouterAddress,
    functionName: 'getPlatformBalance',
  })

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link contextRouterAbi}__ and `functionName` set to `"getUnclaimedBalance"`
 *
 * - [__View Contract on Base Basescan__](https://basescan.org/address/0x676645eF4d3133181572622DABFaeC2170Db670B)
 * - [__View Contract on Base Sepolia Basescan__](https://sepolia.basescan.org/address/0x676645eF4d3133181572622DABFaeC2170Db670B)
 */
export const useReadContextRouterGetUnclaimedBalance =
  /*#__PURE__*/ createUseReadContract({
    abi: contextRouterAbi,
    address: contextRouterAddress,
    functionName: 'getUnclaimedBalance',
  })

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link contextRouterAbi}__ and `functionName` set to `"isOperator"`
 *
 * - [__View Contract on Base Basescan__](https://basescan.org/address/0x676645eF4d3133181572622DABFaeC2170Db670B)
 * - [__View Contract on Base Sepolia Basescan__](https://sepolia.basescan.org/address/0x676645eF4d3133181572622DABFaeC2170Db670B)
 */
export const useReadContextRouterIsOperator =
  /*#__PURE__*/ createUseReadContract({
    abi: contextRouterAbi,
    address: contextRouterAddress,
    functionName: 'isOperator',
  })

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link contextRouterAbi}__ and `functionName` set to `"operators"`
 *
 * - [__View Contract on Base Basescan__](https://basescan.org/address/0x676645eF4d3133181572622DABFaeC2170Db670B)
 * - [__View Contract on Base Sepolia Basescan__](https://sepolia.basescan.org/address/0x676645eF4d3133181572622DABFaeC2170Db670B)
 */
export const useReadContextRouterOperators =
  /*#__PURE__*/ createUseReadContract({
    abi: contextRouterAbi,
    address: contextRouterAddress,
    functionName: 'operators',
  })

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link contextRouterAbi}__ and `functionName` set to `"owner"`
 *
 * - [__View Contract on Base Basescan__](https://basescan.org/address/0x676645eF4d3133181572622DABFaeC2170Db670B)
 * - [__View Contract on Base Sepolia Basescan__](https://sepolia.basescan.org/address/0x676645eF4d3133181572622DABFaeC2170Db670B)
 */
export const useReadContextRouterOwner = /*#__PURE__*/ createUseReadContract({
  abi: contextRouterAbi,
  address: contextRouterAddress,
  functionName: 'owner',
})

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link contextRouterAbi}__ and `functionName` set to `"platformBalance"`
 *
 * - [__View Contract on Base Basescan__](https://basescan.org/address/0x676645eF4d3133181572622DABFaeC2170Db670B)
 * - [__View Contract on Base Sepolia Basescan__](https://sepolia.basescan.org/address/0x676645eF4d3133181572622DABFaeC2170Db670B)
 */
export const useReadContextRouterPlatformBalance =
  /*#__PURE__*/ createUseReadContract({
    abi: contextRouterAbi,
    address: contextRouterAddress,
    functionName: 'platformBalance',
  })

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link contextRouterAbi}__ and `functionName` set to `"usdc"`
 *
 * - [__View Contract on Base Basescan__](https://basescan.org/address/0x676645eF4d3133181572622DABFaeC2170Db670B)
 * - [__View Contract on Base Sepolia Basescan__](https://sepolia.basescan.org/address/0x676645eF4d3133181572622DABFaeC2170Db670B)
 */
export const useReadContextRouterUsdc = /*#__PURE__*/ createUseReadContract({
  abi: contextRouterAbi,
  address: contextRouterAddress,
  functionName: 'usdc',
})

/**
 * Wraps __{@link useWriteContract}__ with `abi` set to __{@link contextRouterAbi}__
 *
 * - [__View Contract on Base Basescan__](https://basescan.org/address/0x676645eF4d3133181572622DABFaeC2170Db670B)
 * - [__View Contract on Base Sepolia Basescan__](https://sepolia.basescan.org/address/0x676645eF4d3133181572622DABFaeC2170Db670B)
 */
export const useWriteContextRouter = /*#__PURE__*/ createUseWriteContract({
  abi: contextRouterAbi,
  address: contextRouterAddress,
})

/**
 * Wraps __{@link useWriteContract}__ with `abi` set to __{@link contextRouterAbi}__ and `functionName` set to `"addOperator"`
 *
 * - [__View Contract on Base Basescan__](https://basescan.org/address/0x676645eF4d3133181572622DABFaeC2170Db670B)
 * - [__View Contract on Base Sepolia Basescan__](https://sepolia.basescan.org/address/0x676645eF4d3133181572622DABFaeC2170Db670B)
 */
export const useWriteContextRouterAddOperator =
  /*#__PURE__*/ createUseWriteContract({
    abi: contextRouterAbi,
    address: contextRouterAddress,
    functionName: 'addOperator',
  })

/**
 * Wraps __{@link useWriteContract}__ with `abi` set to __{@link contextRouterAbi}__ and `functionName` set to `"claimEarnings"`
 *
 * - [__View Contract on Base Basescan__](https://basescan.org/address/0x676645eF4d3133181572622DABFaeC2170Db670B)
 * - [__View Contract on Base Sepolia Basescan__](https://sepolia.basescan.org/address/0x676645eF4d3133181572622DABFaeC2170Db670B)
 */
export const useWriteContextRouterClaimEarnings =
  /*#__PURE__*/ createUseWriteContract({
    abi: contextRouterAbi,
    address: contextRouterAddress,
    functionName: 'claimEarnings',
  })

/**
 * Wraps __{@link useWriteContract}__ with `abi` set to __{@link contextRouterAbi}__ and `functionName` set to `"claimPlatformFees"`
 *
 * - [__View Contract on Base Basescan__](https://basescan.org/address/0x676645eF4d3133181572622DABFaeC2170Db670B)
 * - [__View Contract on Base Sepolia Basescan__](https://sepolia.basescan.org/address/0x676645eF4d3133181572622DABFaeC2170Db670B)
 */
export const useWriteContextRouterClaimPlatformFees =
  /*#__PURE__*/ createUseWriteContract({
    abi: contextRouterAbi,
    address: contextRouterAddress,
    functionName: 'claimPlatformFees',
  })

/**
 * Wraps __{@link useWriteContract}__ with `abi` set to __{@link contextRouterAbi}__ and `functionName` set to `"executeBatchPaidQuery"`
 *
 * - [__View Contract on Base Basescan__](https://basescan.org/address/0x676645eF4d3133181572622DABFaeC2170Db670B)
 * - [__View Contract on Base Sepolia Basescan__](https://sepolia.basescan.org/address/0x676645eF4d3133181572622DABFaeC2170Db670B)
 */
export const useWriteContextRouterExecuteBatchPaidQuery =
  /*#__PURE__*/ createUseWriteContract({
    abi: contextRouterAbi,
    address: contextRouterAddress,
    functionName: 'executeBatchPaidQuery',
  })

/**
 * Wraps __{@link useWriteContract}__ with `abi` set to __{@link contextRouterAbi}__ and `functionName` set to `"executeBatchPaidQueryFor"`
 *
 * - [__View Contract on Base Basescan__](https://basescan.org/address/0x676645eF4d3133181572622DABFaeC2170Db670B)
 * - [__View Contract on Base Sepolia Basescan__](https://sepolia.basescan.org/address/0x676645eF4d3133181572622DABFaeC2170Db670B)
 */
export const useWriteContextRouterExecuteBatchPaidQueryFor =
  /*#__PURE__*/ createUseWriteContract({
    abi: contextRouterAbi,
    address: contextRouterAddress,
    functionName: 'executeBatchPaidQueryFor',
  })

/**
 * Wraps __{@link useWriteContract}__ with `abi` set to __{@link contextRouterAbi}__ and `functionName` set to `"executePaidQuery"`
 *
 * - [__View Contract on Base Basescan__](https://basescan.org/address/0x676645eF4d3133181572622DABFaeC2170Db670B)
 * - [__View Contract on Base Sepolia Basescan__](https://sepolia.basescan.org/address/0x676645eF4d3133181572622DABFaeC2170Db670B)
 */
export const useWriteContextRouterExecutePaidQuery =
  /*#__PURE__*/ createUseWriteContract({
    abi: contextRouterAbi,
    address: contextRouterAddress,
    functionName: 'executePaidQuery',
  })

/**
 * Wraps __{@link useWriteContract}__ with `abi` set to __{@link contextRouterAbi}__ and `functionName` set to `"executePaidQueryFor"`
 *
 * - [__View Contract on Base Basescan__](https://basescan.org/address/0x676645eF4d3133181572622DABFaeC2170Db670B)
 * - [__View Contract on Base Sepolia Basescan__](https://sepolia.basescan.org/address/0x676645eF4d3133181572622DABFaeC2170Db670B)
 */
export const useWriteContextRouterExecutePaidQueryFor =
  /*#__PURE__*/ createUseWriteContract({
    abi: contextRouterAbi,
    address: contextRouterAddress,
    functionName: 'executePaidQueryFor',
  })

/**
 * Wraps __{@link useWriteContract}__ with `abi` set to __{@link contextRouterAbi}__ and `functionName` set to `"executeQueryWithModelCost"`
 *
 * - [__View Contract on Base Basescan__](https://basescan.org/address/0x676645eF4d3133181572622DABFaeC2170Db670B)
 * - [__View Contract on Base Sepolia Basescan__](https://sepolia.basescan.org/address/0x676645eF4d3133181572622DABFaeC2170Db670B)
 */
export const useWriteContextRouterExecuteQueryWithModelCost =
  /*#__PURE__*/ createUseWriteContract({
    abi: contextRouterAbi,
    address: contextRouterAddress,
    functionName: 'executeQueryWithModelCost',
  })

/**
 * Wraps __{@link useWriteContract}__ with `abi` set to __{@link contextRouterAbi}__ and `functionName` set to `"executeQueryWithModelCostFor"`
 *
 * - [__View Contract on Base Basescan__](https://basescan.org/address/0x676645eF4d3133181572622DABFaeC2170Db670B)
 * - [__View Contract on Base Sepolia Basescan__](https://sepolia.basescan.org/address/0x676645eF4d3133181572622DABFaeC2170Db670B)
 */
export const useWriteContextRouterExecuteQueryWithModelCostFor =
  /*#__PURE__*/ createUseWriteContract({
    abi: contextRouterAbi,
    address: contextRouterAddress,
    functionName: 'executeQueryWithModelCostFor',
  })

/**
 * Wraps __{@link useWriteContract}__ with `abi` set to __{@link contextRouterAbi}__ and `functionName` set to `"removeOperator"`
 *
 * - [__View Contract on Base Basescan__](https://basescan.org/address/0x676645eF4d3133181572622DABFaeC2170Db670B)
 * - [__View Contract on Base Sepolia Basescan__](https://sepolia.basescan.org/address/0x676645eF4d3133181572622DABFaeC2170Db670B)
 */
export const useWriteContextRouterRemoveOperator =
  /*#__PURE__*/ createUseWriteContract({
    abi: contextRouterAbi,
    address: contextRouterAddress,
    functionName: 'removeOperator',
  })

/**
 * Wraps __{@link useWriteContract}__ with `abi` set to __{@link contextRouterAbi}__ and `functionName` set to `"renounceOwnership"`
 *
 * - [__View Contract on Base Basescan__](https://basescan.org/address/0x676645eF4d3133181572622DABFaeC2170Db670B)
 * - [__View Contract on Base Sepolia Basescan__](https://sepolia.basescan.org/address/0x676645eF4d3133181572622DABFaeC2170Db670B)
 */
export const useWriteContextRouterRenounceOwnership =
  /*#__PURE__*/ createUseWriteContract({
    abi: contextRouterAbi,
    address: contextRouterAddress,
    functionName: 'renounceOwnership',
  })

/**
 * Wraps __{@link useWriteContract}__ with `abi` set to __{@link contextRouterAbi}__ and `functionName` set to `"transferOwnership"`
 *
 * - [__View Contract on Base Basescan__](https://basescan.org/address/0x676645eF4d3133181572622DABFaeC2170Db670B)
 * - [__View Contract on Base Sepolia Basescan__](https://sepolia.basescan.org/address/0x676645eF4d3133181572622DABFaeC2170Db670B)
 */
export const useWriteContextRouterTransferOwnership =
  /*#__PURE__*/ createUseWriteContract({
    abi: contextRouterAbi,
    address: contextRouterAddress,
    functionName: 'transferOwnership',
  })

/**
 * Wraps __{@link useSimulateContract}__ with `abi` set to __{@link contextRouterAbi}__
 *
 * - [__View Contract on Base Basescan__](https://basescan.org/address/0x676645eF4d3133181572622DABFaeC2170Db670B)
 * - [__View Contract on Base Sepolia Basescan__](https://sepolia.basescan.org/address/0x676645eF4d3133181572622DABFaeC2170Db670B)
 */
export const useSimulateContextRouter = /*#__PURE__*/ createUseSimulateContract(
  { abi: contextRouterAbi, address: contextRouterAddress },
)

/**
 * Wraps __{@link useSimulateContract}__ with `abi` set to __{@link contextRouterAbi}__ and `functionName` set to `"addOperator"`
 *
 * - [__View Contract on Base Basescan__](https://basescan.org/address/0x676645eF4d3133181572622DABFaeC2170Db670B)
 * - [__View Contract on Base Sepolia Basescan__](https://sepolia.basescan.org/address/0x676645eF4d3133181572622DABFaeC2170Db670B)
 */
export const useSimulateContextRouterAddOperator =
  /*#__PURE__*/ createUseSimulateContract({
    abi: contextRouterAbi,
    address: contextRouterAddress,
    functionName: 'addOperator',
  })

/**
 * Wraps __{@link useSimulateContract}__ with `abi` set to __{@link contextRouterAbi}__ and `functionName` set to `"claimEarnings"`
 *
 * - [__View Contract on Base Basescan__](https://basescan.org/address/0x676645eF4d3133181572622DABFaeC2170Db670B)
 * - [__View Contract on Base Sepolia Basescan__](https://sepolia.basescan.org/address/0x676645eF4d3133181572622DABFaeC2170Db670B)
 */
export const useSimulateContextRouterClaimEarnings =
  /*#__PURE__*/ createUseSimulateContract({
    abi: contextRouterAbi,
    address: contextRouterAddress,
    functionName: 'claimEarnings',
  })

/**
 * Wraps __{@link useSimulateContract}__ with `abi` set to __{@link contextRouterAbi}__ and `functionName` set to `"claimPlatformFees"`
 *
 * - [__View Contract on Base Basescan__](https://basescan.org/address/0x676645eF4d3133181572622DABFaeC2170Db670B)
 * - [__View Contract on Base Sepolia Basescan__](https://sepolia.basescan.org/address/0x676645eF4d3133181572622DABFaeC2170Db670B)
 */
export const useSimulateContextRouterClaimPlatformFees =
  /*#__PURE__*/ createUseSimulateContract({
    abi: contextRouterAbi,
    address: contextRouterAddress,
    functionName: 'claimPlatformFees',
  })

/**
 * Wraps __{@link useSimulateContract}__ with `abi` set to __{@link contextRouterAbi}__ and `functionName` set to `"executeBatchPaidQuery"`
 *
 * - [__View Contract on Base Basescan__](https://basescan.org/address/0x676645eF4d3133181572622DABFaeC2170Db670B)
 * - [__View Contract on Base Sepolia Basescan__](https://sepolia.basescan.org/address/0x676645eF4d3133181572622DABFaeC2170Db670B)
 */
export const useSimulateContextRouterExecuteBatchPaidQuery =
  /*#__PURE__*/ createUseSimulateContract({
    abi: contextRouterAbi,
    address: contextRouterAddress,
    functionName: 'executeBatchPaidQuery',
  })

/**
 * Wraps __{@link useSimulateContract}__ with `abi` set to __{@link contextRouterAbi}__ and `functionName` set to `"executeBatchPaidQueryFor"`
 *
 * - [__View Contract on Base Basescan__](https://basescan.org/address/0x676645eF4d3133181572622DABFaeC2170Db670B)
 * - [__View Contract on Base Sepolia Basescan__](https://sepolia.basescan.org/address/0x676645eF4d3133181572622DABFaeC2170Db670B)
 */
export const useSimulateContextRouterExecuteBatchPaidQueryFor =
  /*#__PURE__*/ createUseSimulateContract({
    abi: contextRouterAbi,
    address: contextRouterAddress,
    functionName: 'executeBatchPaidQueryFor',
  })

/**
 * Wraps __{@link useSimulateContract}__ with `abi` set to __{@link contextRouterAbi}__ and `functionName` set to `"executePaidQuery"`
 *
 * - [__View Contract on Base Basescan__](https://basescan.org/address/0x676645eF4d3133181572622DABFaeC2170Db670B)
 * - [__View Contract on Base Sepolia Basescan__](https://sepolia.basescan.org/address/0x676645eF4d3133181572622DABFaeC2170Db670B)
 */
export const useSimulateContextRouterExecutePaidQuery =
  /*#__PURE__*/ createUseSimulateContract({
    abi: contextRouterAbi,
    address: contextRouterAddress,
    functionName: 'executePaidQuery',
  })

/**
 * Wraps __{@link useSimulateContract}__ with `abi` set to __{@link contextRouterAbi}__ and `functionName` set to `"executePaidQueryFor"`
 *
 * - [__View Contract on Base Basescan__](https://basescan.org/address/0x676645eF4d3133181572622DABFaeC2170Db670B)
 * - [__View Contract on Base Sepolia Basescan__](https://sepolia.basescan.org/address/0x676645eF4d3133181572622DABFaeC2170Db670B)
 */
export const useSimulateContextRouterExecutePaidQueryFor =
  /*#__PURE__*/ createUseSimulateContract({
    abi: contextRouterAbi,
    address: contextRouterAddress,
    functionName: 'executePaidQueryFor',
  })

/**
 * Wraps __{@link useSimulateContract}__ with `abi` set to __{@link contextRouterAbi}__ and `functionName` set to `"executeQueryWithModelCost"`
 *
 * - [__View Contract on Base Basescan__](https://basescan.org/address/0x676645eF4d3133181572622DABFaeC2170Db670B)
 * - [__View Contract on Base Sepolia Basescan__](https://sepolia.basescan.org/address/0x676645eF4d3133181572622DABFaeC2170Db670B)
 */
export const useSimulateContextRouterExecuteQueryWithModelCost =
  /*#__PURE__*/ createUseSimulateContract({
    abi: contextRouterAbi,
    address: contextRouterAddress,
    functionName: 'executeQueryWithModelCost',
  })

/**
 * Wraps __{@link useSimulateContract}__ with `abi` set to __{@link contextRouterAbi}__ and `functionName` set to `"executeQueryWithModelCostFor"`
 *
 * - [__View Contract on Base Basescan__](https://basescan.org/address/0x676645eF4d3133181572622DABFaeC2170Db670B)
 * - [__View Contract on Base Sepolia Basescan__](https://sepolia.basescan.org/address/0x676645eF4d3133181572622DABFaeC2170Db670B)
 */
export const useSimulateContextRouterExecuteQueryWithModelCostFor =
  /*#__PURE__*/ createUseSimulateContract({
    abi: contextRouterAbi,
    address: contextRouterAddress,
    functionName: 'executeQueryWithModelCostFor',
  })

/**
 * Wraps __{@link useSimulateContract}__ with `abi` set to __{@link contextRouterAbi}__ and `functionName` set to `"removeOperator"`
 *
 * - [__View Contract on Base Basescan__](https://basescan.org/address/0x676645eF4d3133181572622DABFaeC2170Db670B)
 * - [__View Contract on Base Sepolia Basescan__](https://sepolia.basescan.org/address/0x676645eF4d3133181572622DABFaeC2170Db670B)
 */
export const useSimulateContextRouterRemoveOperator =
  /*#__PURE__*/ createUseSimulateContract({
    abi: contextRouterAbi,
    address: contextRouterAddress,
    functionName: 'removeOperator',
  })

/**
 * Wraps __{@link useSimulateContract}__ with `abi` set to __{@link contextRouterAbi}__ and `functionName` set to `"renounceOwnership"`
 *
 * - [__View Contract on Base Basescan__](https://basescan.org/address/0x676645eF4d3133181572622DABFaeC2170Db670B)
 * - [__View Contract on Base Sepolia Basescan__](https://sepolia.basescan.org/address/0x676645eF4d3133181572622DABFaeC2170Db670B)
 */
export const useSimulateContextRouterRenounceOwnership =
  /*#__PURE__*/ createUseSimulateContract({
    abi: contextRouterAbi,
    address: contextRouterAddress,
    functionName: 'renounceOwnership',
  })

/**
 * Wraps __{@link useSimulateContract}__ with `abi` set to __{@link contextRouterAbi}__ and `functionName` set to `"transferOwnership"`
 *
 * - [__View Contract on Base Basescan__](https://basescan.org/address/0x676645eF4d3133181572622DABFaeC2170Db670B)
 * - [__View Contract on Base Sepolia Basescan__](https://sepolia.basescan.org/address/0x676645eF4d3133181572622DABFaeC2170Db670B)
 */
export const useSimulateContextRouterTransferOwnership =
  /*#__PURE__*/ createUseSimulateContract({
    abi: contextRouterAbi,
    address: contextRouterAddress,
    functionName: 'transferOwnership',
  })

/**
 * Wraps __{@link useWatchContractEvent}__ with `abi` set to __{@link contextRouterAbi}__
 *
 * - [__View Contract on Base Basescan__](https://basescan.org/address/0x676645eF4d3133181572622DABFaeC2170Db670B)
 * - [__View Contract on Base Sepolia Basescan__](https://sepolia.basescan.org/address/0x676645eF4d3133181572622DABFaeC2170Db670B)
 */
export const useWatchContextRouterEvent =
  /*#__PURE__*/ createUseWatchContractEvent({
    abi: contextRouterAbi,
    address: contextRouterAddress,
  })

/**
 * Wraps __{@link useWatchContractEvent}__ with `abi` set to __{@link contextRouterAbi}__ and `eventName` set to `"EarningsClaimed"`
 *
 * - [__View Contract on Base Basescan__](https://basescan.org/address/0x676645eF4d3133181572622DABFaeC2170Db670B)
 * - [__View Contract on Base Sepolia Basescan__](https://sepolia.basescan.org/address/0x676645eF4d3133181572622DABFaeC2170Db670B)
 */
export const useWatchContextRouterEarningsClaimedEvent =
  /*#__PURE__*/ createUseWatchContractEvent({
    abi: contextRouterAbi,
    address: contextRouterAddress,
    eventName: 'EarningsClaimed',
  })

/**
 * Wraps __{@link useWatchContractEvent}__ with `abi` set to __{@link contextRouterAbi}__ and `eventName` set to `"ModelCostPaid"`
 *
 * - [__View Contract on Base Basescan__](https://basescan.org/address/0x676645eF4d3133181572622DABFaeC2170Db670B)
 * - [__View Contract on Base Sepolia Basescan__](https://sepolia.basescan.org/address/0x676645eF4d3133181572622DABFaeC2170Db670B)
 */
export const useWatchContextRouterModelCostPaidEvent =
  /*#__PURE__*/ createUseWatchContractEvent({
    abi: contextRouterAbi,
    address: contextRouterAddress,
    eventName: 'ModelCostPaid',
  })

/**
 * Wraps __{@link useWatchContractEvent}__ with `abi` set to __{@link contextRouterAbi}__ and `eventName` set to `"OperatorAdded"`
 *
 * - [__View Contract on Base Basescan__](https://basescan.org/address/0x676645eF4d3133181572622DABFaeC2170Db670B)
 * - [__View Contract on Base Sepolia Basescan__](https://sepolia.basescan.org/address/0x676645eF4d3133181572622DABFaeC2170Db670B)
 */
export const useWatchContextRouterOperatorAddedEvent =
  /*#__PURE__*/ createUseWatchContractEvent({
    abi: contextRouterAbi,
    address: contextRouterAddress,
    eventName: 'OperatorAdded',
  })

/**
 * Wraps __{@link useWatchContractEvent}__ with `abi` set to __{@link contextRouterAbi}__ and `eventName` set to `"OperatorRemoved"`
 *
 * - [__View Contract on Base Basescan__](https://basescan.org/address/0x676645eF4d3133181572622DABFaeC2170Db670B)
 * - [__View Contract on Base Sepolia Basescan__](https://sepolia.basescan.org/address/0x676645eF4d3133181572622DABFaeC2170Db670B)
 */
export const useWatchContextRouterOperatorRemovedEvent =
  /*#__PURE__*/ createUseWatchContractEvent({
    abi: contextRouterAbi,
    address: contextRouterAddress,
    eventName: 'OperatorRemoved',
  })

/**
 * Wraps __{@link useWatchContractEvent}__ with `abi` set to __{@link contextRouterAbi}__ and `eventName` set to `"OwnershipTransferred"`
 *
 * - [__View Contract on Base Basescan__](https://basescan.org/address/0x676645eF4d3133181572622DABFaeC2170Db670B)
 * - [__View Contract on Base Sepolia Basescan__](https://sepolia.basescan.org/address/0x676645eF4d3133181572622DABFaeC2170Db670B)
 */
export const useWatchContextRouterOwnershipTransferredEvent =
  /*#__PURE__*/ createUseWatchContractEvent({
    abi: contextRouterAbi,
    address: contextRouterAddress,
    eventName: 'OwnershipTransferred',
  })

/**
 * Wraps __{@link useWatchContractEvent}__ with `abi` set to __{@link contextRouterAbi}__ and `eventName` set to `"PlatformFeesClaimed"`
 *
 * - [__View Contract on Base Basescan__](https://basescan.org/address/0x676645eF4d3133181572622DABFaeC2170Db670B)
 * - [__View Contract on Base Sepolia Basescan__](https://sepolia.basescan.org/address/0x676645eF4d3133181572622DABFaeC2170Db670B)
 */
export const useWatchContextRouterPlatformFeesClaimedEvent =
  /*#__PURE__*/ createUseWatchContractEvent({
    abi: contextRouterAbi,
    address: contextRouterAddress,
    eventName: 'PlatformFeesClaimed',
  })

/**
 * Wraps __{@link useWatchContractEvent}__ with `abi` set to __{@link contextRouterAbi}__ and `eventName` set to `"QueryPaid"`
 *
 * - [__View Contract on Base Basescan__](https://basescan.org/address/0x676645eF4d3133181572622DABFaeC2170Db670B)
 * - [__View Contract on Base Sepolia Basescan__](https://sepolia.basescan.org/address/0x676645eF4d3133181572622DABFaeC2170Db670B)
 */
export const useWatchContextRouterQueryPaidEvent =
  /*#__PURE__*/ createUseWatchContractEvent({
    abi: contextRouterAbi,
    address: contextRouterAddress,
    eventName: 'QueryPaid',
  })

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link erc20Abi}__
 */
export const useReadErc20 = /*#__PURE__*/ createUseReadContract({
  abi: erc20Abi,
})

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link erc20Abi}__ and `functionName` set to `"allowance"`
 */
export const useReadErc20Allowance = /*#__PURE__*/ createUseReadContract({
  abi: erc20Abi,
  functionName: 'allowance',
})

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link erc20Abi}__ and `functionName` set to `"balanceOf"`
 */
export const useReadErc20BalanceOf = /*#__PURE__*/ createUseReadContract({
  abi: erc20Abi,
  functionName: 'balanceOf',
})

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link erc20Abi}__ and `functionName` set to `"decimals"`
 */
export const useReadErc20Decimals = /*#__PURE__*/ createUseReadContract({
  abi: erc20Abi,
  functionName: 'decimals',
})

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link erc20Abi}__ and `functionName` set to `"name"`
 */
export const useReadErc20Name = /*#__PURE__*/ createUseReadContract({
  abi: erc20Abi,
  functionName: 'name',
})

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link erc20Abi}__ and `functionName` set to `"symbol"`
 */
export const useReadErc20Symbol = /*#__PURE__*/ createUseReadContract({
  abi: erc20Abi,
  functionName: 'symbol',
})

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link erc20Abi}__ and `functionName` set to `"totalSupply"`
 */
export const useReadErc20TotalSupply = /*#__PURE__*/ createUseReadContract({
  abi: erc20Abi,
  functionName: 'totalSupply',
})

/**
 * Wraps __{@link useWriteContract}__ with `abi` set to __{@link erc20Abi}__
 */
export const useWriteErc20 = /*#__PURE__*/ createUseWriteContract({
  abi: erc20Abi,
})

/**
 * Wraps __{@link useWriteContract}__ with `abi` set to __{@link erc20Abi}__ and `functionName` set to `"approve"`
 */
export const useWriteErc20Approve = /*#__PURE__*/ createUseWriteContract({
  abi: erc20Abi,
  functionName: 'approve',
})

/**
 * Wraps __{@link useWriteContract}__ with `abi` set to __{@link erc20Abi}__ and `functionName` set to `"transfer"`
 */
export const useWriteErc20Transfer = /*#__PURE__*/ createUseWriteContract({
  abi: erc20Abi,
  functionName: 'transfer',
})

/**
 * Wraps __{@link useWriteContract}__ with `abi` set to __{@link erc20Abi}__ and `functionName` set to `"transferFrom"`
 */
export const useWriteErc20TransferFrom = /*#__PURE__*/ createUseWriteContract({
  abi: erc20Abi,
  functionName: 'transferFrom',
})

/**
 * Wraps __{@link useSimulateContract}__ with `abi` set to __{@link erc20Abi}__
 */
export const useSimulateErc20 = /*#__PURE__*/ createUseSimulateContract({
  abi: erc20Abi,
})

/**
 * Wraps __{@link useSimulateContract}__ with `abi` set to __{@link erc20Abi}__ and `functionName` set to `"approve"`
 */
export const useSimulateErc20Approve = /*#__PURE__*/ createUseSimulateContract({
  abi: erc20Abi,
  functionName: 'approve',
})

/**
 * Wraps __{@link useSimulateContract}__ with `abi` set to __{@link erc20Abi}__ and `functionName` set to `"transfer"`
 */
export const useSimulateErc20Transfer = /*#__PURE__*/ createUseSimulateContract(
  { abi: erc20Abi, functionName: 'transfer' },
)

/**
 * Wraps __{@link useSimulateContract}__ with `abi` set to __{@link erc20Abi}__ and `functionName` set to `"transferFrom"`
 */
export const useSimulateErc20TransferFrom =
  /*#__PURE__*/ createUseSimulateContract({
    abi: erc20Abi,
    functionName: 'transferFrom',
  })

/**
 * Wraps __{@link useWatchContractEvent}__ with `abi` set to __{@link erc20Abi}__
 */
export const useWatchErc20Event = /*#__PURE__*/ createUseWatchContractEvent({
  abi: erc20Abi,
})

/**
 * Wraps __{@link useWatchContractEvent}__ with `abi` set to __{@link erc20Abi}__ and `eventName` set to `"Approval"`
 */
export const useWatchErc20ApprovalEvent =
  /*#__PURE__*/ createUseWatchContractEvent({
    abi: erc20Abi,
    eventName: 'Approval',
  })

/**
 * Wraps __{@link useWatchContractEvent}__ with `abi` set to __{@link erc20Abi}__ and `eventName` set to `"Transfer"`
 */
export const useWatchErc20TransferEvent =
  /*#__PURE__*/ createUseWatchContractEvent({
    abi: erc20Abi,
    eventName: 'Transfer',
  })

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link ierc1363Abi}__
 */
export const useReadIerc1363 = /*#__PURE__*/ createUseReadContract({
  abi: ierc1363Abi,
})

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link ierc1363Abi}__ and `functionName` set to `"allowance"`
 */
export const useReadIerc1363Allowance = /*#__PURE__*/ createUseReadContract({
  abi: ierc1363Abi,
  functionName: 'allowance',
})

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link ierc1363Abi}__ and `functionName` set to `"balanceOf"`
 */
export const useReadIerc1363BalanceOf = /*#__PURE__*/ createUseReadContract({
  abi: ierc1363Abi,
  functionName: 'balanceOf',
})

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link ierc1363Abi}__ and `functionName` set to `"supportsInterface"`
 */
export const useReadIerc1363SupportsInterface =
  /*#__PURE__*/ createUseReadContract({
    abi: ierc1363Abi,
    functionName: 'supportsInterface',
  })

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link ierc1363Abi}__ and `functionName` set to `"totalSupply"`
 */
export const useReadIerc1363TotalSupply = /*#__PURE__*/ createUseReadContract({
  abi: ierc1363Abi,
  functionName: 'totalSupply',
})

/**
 * Wraps __{@link useWriteContract}__ with `abi` set to __{@link ierc1363Abi}__
 */
export const useWriteIerc1363 = /*#__PURE__*/ createUseWriteContract({
  abi: ierc1363Abi,
})

/**
 * Wraps __{@link useWriteContract}__ with `abi` set to __{@link ierc1363Abi}__ and `functionName` set to `"approve"`
 */
export const useWriteIerc1363Approve = /*#__PURE__*/ createUseWriteContract({
  abi: ierc1363Abi,
  functionName: 'approve',
})

/**
 * Wraps __{@link useWriteContract}__ with `abi` set to __{@link ierc1363Abi}__ and `functionName` set to `"approveAndCall"`
 */
export const useWriteIerc1363ApproveAndCall =
  /*#__PURE__*/ createUseWriteContract({
    abi: ierc1363Abi,
    functionName: 'approveAndCall',
  })

/**
 * Wraps __{@link useWriteContract}__ with `abi` set to __{@link ierc1363Abi}__ and `functionName` set to `"transfer"`
 */
export const useWriteIerc1363Transfer = /*#__PURE__*/ createUseWriteContract({
  abi: ierc1363Abi,
  functionName: 'transfer',
})

/**
 * Wraps __{@link useWriteContract}__ with `abi` set to __{@link ierc1363Abi}__ and `functionName` set to `"transferAndCall"`
 */
export const useWriteIerc1363TransferAndCall =
  /*#__PURE__*/ createUseWriteContract({
    abi: ierc1363Abi,
    functionName: 'transferAndCall',
  })

/**
 * Wraps __{@link useWriteContract}__ with `abi` set to __{@link ierc1363Abi}__ and `functionName` set to `"transferFrom"`
 */
export const useWriteIerc1363TransferFrom =
  /*#__PURE__*/ createUseWriteContract({
    abi: ierc1363Abi,
    functionName: 'transferFrom',
  })

/**
 * Wraps __{@link useWriteContract}__ with `abi` set to __{@link ierc1363Abi}__ and `functionName` set to `"transferFromAndCall"`
 */
export const useWriteIerc1363TransferFromAndCall =
  /*#__PURE__*/ createUseWriteContract({
    abi: ierc1363Abi,
    functionName: 'transferFromAndCall',
  })

/**
 * Wraps __{@link useSimulateContract}__ with `abi` set to __{@link ierc1363Abi}__
 */
export const useSimulateIerc1363 = /*#__PURE__*/ createUseSimulateContract({
  abi: ierc1363Abi,
})

/**
 * Wraps __{@link useSimulateContract}__ with `abi` set to __{@link ierc1363Abi}__ and `functionName` set to `"approve"`
 */
export const useSimulateIerc1363Approve =
  /*#__PURE__*/ createUseSimulateContract({
    abi: ierc1363Abi,
    functionName: 'approve',
  })

/**
 * Wraps __{@link useSimulateContract}__ with `abi` set to __{@link ierc1363Abi}__ and `functionName` set to `"approveAndCall"`
 */
export const useSimulateIerc1363ApproveAndCall =
  /*#__PURE__*/ createUseSimulateContract({
    abi: ierc1363Abi,
    functionName: 'approveAndCall',
  })

/**
 * Wraps __{@link useSimulateContract}__ with `abi` set to __{@link ierc1363Abi}__ and `functionName` set to `"transfer"`
 */
export const useSimulateIerc1363Transfer =
  /*#__PURE__*/ createUseSimulateContract({
    abi: ierc1363Abi,
    functionName: 'transfer',
  })

/**
 * Wraps __{@link useSimulateContract}__ with `abi` set to __{@link ierc1363Abi}__ and `functionName` set to `"transferAndCall"`
 */
export const useSimulateIerc1363TransferAndCall =
  /*#__PURE__*/ createUseSimulateContract({
    abi: ierc1363Abi,
    functionName: 'transferAndCall',
  })

/**
 * Wraps __{@link useSimulateContract}__ with `abi` set to __{@link ierc1363Abi}__ and `functionName` set to `"transferFrom"`
 */
export const useSimulateIerc1363TransferFrom =
  /*#__PURE__*/ createUseSimulateContract({
    abi: ierc1363Abi,
    functionName: 'transferFrom',
  })

/**
 * Wraps __{@link useSimulateContract}__ with `abi` set to __{@link ierc1363Abi}__ and `functionName` set to `"transferFromAndCall"`
 */
export const useSimulateIerc1363TransferFromAndCall =
  /*#__PURE__*/ createUseSimulateContract({
    abi: ierc1363Abi,
    functionName: 'transferFromAndCall',
  })

/**
 * Wraps __{@link useWatchContractEvent}__ with `abi` set to __{@link ierc1363Abi}__
 */
export const useWatchIerc1363Event = /*#__PURE__*/ createUseWatchContractEvent({
  abi: ierc1363Abi,
})

/**
 * Wraps __{@link useWatchContractEvent}__ with `abi` set to __{@link ierc1363Abi}__ and `eventName` set to `"Approval"`
 */
export const useWatchIerc1363ApprovalEvent =
  /*#__PURE__*/ createUseWatchContractEvent({
    abi: ierc1363Abi,
    eventName: 'Approval',
  })

/**
 * Wraps __{@link useWatchContractEvent}__ with `abi` set to __{@link ierc1363Abi}__ and `eventName` set to `"Transfer"`
 */
export const useWatchIerc1363TransferEvent =
  /*#__PURE__*/ createUseWatchContractEvent({
    abi: ierc1363Abi,
    eventName: 'Transfer',
  })

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link ierc165Abi}__
 */
export const useReadIerc165 = /*#__PURE__*/ createUseReadContract({
  abi: ierc165Abi,
})

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link ierc165Abi}__ and `functionName` set to `"supportsInterface"`
 */
export const useReadIerc165SupportsInterface =
  /*#__PURE__*/ createUseReadContract({
    abi: ierc165Abi,
    functionName: 'supportsInterface',
  })

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link ierc20Abi}__
 */
export const useReadIerc20 = /*#__PURE__*/ createUseReadContract({
  abi: ierc20Abi,
})

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link ierc20Abi}__ and `functionName` set to `"allowance"`
 */
export const useReadIerc20Allowance = /*#__PURE__*/ createUseReadContract({
  abi: ierc20Abi,
  functionName: 'allowance',
})

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link ierc20Abi}__ and `functionName` set to `"balanceOf"`
 */
export const useReadIerc20BalanceOf = /*#__PURE__*/ createUseReadContract({
  abi: ierc20Abi,
  functionName: 'balanceOf',
})

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link ierc20Abi}__ and `functionName` set to `"totalSupply"`
 */
export const useReadIerc20TotalSupply = /*#__PURE__*/ createUseReadContract({
  abi: ierc20Abi,
  functionName: 'totalSupply',
})

/**
 * Wraps __{@link useWriteContract}__ with `abi` set to __{@link ierc20Abi}__
 */
export const useWriteIerc20 = /*#__PURE__*/ createUseWriteContract({
  abi: ierc20Abi,
})

/**
 * Wraps __{@link useWriteContract}__ with `abi` set to __{@link ierc20Abi}__ and `functionName` set to `"approve"`
 */
export const useWriteIerc20Approve = /*#__PURE__*/ createUseWriteContract({
  abi: ierc20Abi,
  functionName: 'approve',
})

/**
 * Wraps __{@link useWriteContract}__ with `abi` set to __{@link ierc20Abi}__ and `functionName` set to `"transfer"`
 */
export const useWriteIerc20Transfer = /*#__PURE__*/ createUseWriteContract({
  abi: ierc20Abi,
  functionName: 'transfer',
})

/**
 * Wraps __{@link useWriteContract}__ with `abi` set to __{@link ierc20Abi}__ and `functionName` set to `"transferFrom"`
 */
export const useWriteIerc20TransferFrom = /*#__PURE__*/ createUseWriteContract({
  abi: ierc20Abi,
  functionName: 'transferFrom',
})

/**
 * Wraps __{@link useSimulateContract}__ with `abi` set to __{@link ierc20Abi}__
 */
export const useSimulateIerc20 = /*#__PURE__*/ createUseSimulateContract({
  abi: ierc20Abi,
})

/**
 * Wraps __{@link useSimulateContract}__ with `abi` set to __{@link ierc20Abi}__ and `functionName` set to `"approve"`
 */
export const useSimulateIerc20Approve = /*#__PURE__*/ createUseSimulateContract(
  { abi: ierc20Abi, functionName: 'approve' },
)

/**
 * Wraps __{@link useSimulateContract}__ with `abi` set to __{@link ierc20Abi}__ and `functionName` set to `"transfer"`
 */
export const useSimulateIerc20Transfer =
  /*#__PURE__*/ createUseSimulateContract({
    abi: ierc20Abi,
    functionName: 'transfer',
  })

/**
 * Wraps __{@link useSimulateContract}__ with `abi` set to __{@link ierc20Abi}__ and `functionName` set to `"transferFrom"`
 */
export const useSimulateIerc20TransferFrom =
  /*#__PURE__*/ createUseSimulateContract({
    abi: ierc20Abi,
    functionName: 'transferFrom',
  })

/**
 * Wraps __{@link useWatchContractEvent}__ with `abi` set to __{@link ierc20Abi}__
 */
export const useWatchIerc20Event = /*#__PURE__*/ createUseWatchContractEvent({
  abi: ierc20Abi,
})

/**
 * Wraps __{@link useWatchContractEvent}__ with `abi` set to __{@link ierc20Abi}__ and `eventName` set to `"Approval"`
 */
export const useWatchIerc20ApprovalEvent =
  /*#__PURE__*/ createUseWatchContractEvent({
    abi: ierc20Abi,
    eventName: 'Approval',
  })

/**
 * Wraps __{@link useWatchContractEvent}__ with `abi` set to __{@link ierc20Abi}__ and `eventName` set to `"Transfer"`
 */
export const useWatchIerc20TransferEvent =
  /*#__PURE__*/ createUseWatchContractEvent({
    abi: ierc20Abi,
    eventName: 'Transfer',
  })

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link ierc20MetadataAbi}__
 */
export const useReadIerc20Metadata = /*#__PURE__*/ createUseReadContract({
  abi: ierc20MetadataAbi,
})

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link ierc20MetadataAbi}__ and `functionName` set to `"allowance"`
 */
export const useReadIerc20MetadataAllowance =
  /*#__PURE__*/ createUseReadContract({
    abi: ierc20MetadataAbi,
    functionName: 'allowance',
  })

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link ierc20MetadataAbi}__ and `functionName` set to `"balanceOf"`
 */
export const useReadIerc20MetadataBalanceOf =
  /*#__PURE__*/ createUseReadContract({
    abi: ierc20MetadataAbi,
    functionName: 'balanceOf',
  })

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link ierc20MetadataAbi}__ and `functionName` set to `"decimals"`
 */
export const useReadIerc20MetadataDecimals =
  /*#__PURE__*/ createUseReadContract({
    abi: ierc20MetadataAbi,
    functionName: 'decimals',
  })

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link ierc20MetadataAbi}__ and `functionName` set to `"name"`
 */
export const useReadIerc20MetadataName = /*#__PURE__*/ createUseReadContract({
  abi: ierc20MetadataAbi,
  functionName: 'name',
})

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link ierc20MetadataAbi}__ and `functionName` set to `"symbol"`
 */
export const useReadIerc20MetadataSymbol = /*#__PURE__*/ createUseReadContract({
  abi: ierc20MetadataAbi,
  functionName: 'symbol',
})

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link ierc20MetadataAbi}__ and `functionName` set to `"totalSupply"`
 */
export const useReadIerc20MetadataTotalSupply =
  /*#__PURE__*/ createUseReadContract({
    abi: ierc20MetadataAbi,
    functionName: 'totalSupply',
  })

/**
 * Wraps __{@link useWriteContract}__ with `abi` set to __{@link ierc20MetadataAbi}__
 */
export const useWriteIerc20Metadata = /*#__PURE__*/ createUseWriteContract({
  abi: ierc20MetadataAbi,
})

/**
 * Wraps __{@link useWriteContract}__ with `abi` set to __{@link ierc20MetadataAbi}__ and `functionName` set to `"approve"`
 */
export const useWriteIerc20MetadataApprove =
  /*#__PURE__*/ createUseWriteContract({
    abi: ierc20MetadataAbi,
    functionName: 'approve',
  })

/**
 * Wraps __{@link useWriteContract}__ with `abi` set to __{@link ierc20MetadataAbi}__ and `functionName` set to `"transfer"`
 */
export const useWriteIerc20MetadataTransfer =
  /*#__PURE__*/ createUseWriteContract({
    abi: ierc20MetadataAbi,
    functionName: 'transfer',
  })

/**
 * Wraps __{@link useWriteContract}__ with `abi` set to __{@link ierc20MetadataAbi}__ and `functionName` set to `"transferFrom"`
 */
export const useWriteIerc20MetadataTransferFrom =
  /*#__PURE__*/ createUseWriteContract({
    abi: ierc20MetadataAbi,
    functionName: 'transferFrom',
  })

/**
 * Wraps __{@link useSimulateContract}__ with `abi` set to __{@link ierc20MetadataAbi}__
 */
export const useSimulateIerc20Metadata =
  /*#__PURE__*/ createUseSimulateContract({ abi: ierc20MetadataAbi })

/**
 * Wraps __{@link useSimulateContract}__ with `abi` set to __{@link ierc20MetadataAbi}__ and `functionName` set to `"approve"`
 */
export const useSimulateIerc20MetadataApprove =
  /*#__PURE__*/ createUseSimulateContract({
    abi: ierc20MetadataAbi,
    functionName: 'approve',
  })

/**
 * Wraps __{@link useSimulateContract}__ with `abi` set to __{@link ierc20MetadataAbi}__ and `functionName` set to `"transfer"`
 */
export const useSimulateIerc20MetadataTransfer =
  /*#__PURE__*/ createUseSimulateContract({
    abi: ierc20MetadataAbi,
    functionName: 'transfer',
  })

/**
 * Wraps __{@link useSimulateContract}__ with `abi` set to __{@link ierc20MetadataAbi}__ and `functionName` set to `"transferFrom"`
 */
export const useSimulateIerc20MetadataTransferFrom =
  /*#__PURE__*/ createUseSimulateContract({
    abi: ierc20MetadataAbi,
    functionName: 'transferFrom',
  })

/**
 * Wraps __{@link useWatchContractEvent}__ with `abi` set to __{@link ierc20MetadataAbi}__
 */
export const useWatchIerc20MetadataEvent =
  /*#__PURE__*/ createUseWatchContractEvent({ abi: ierc20MetadataAbi })

/**
 * Wraps __{@link useWatchContractEvent}__ with `abi` set to __{@link ierc20MetadataAbi}__ and `eventName` set to `"Approval"`
 */
export const useWatchIerc20MetadataApprovalEvent =
  /*#__PURE__*/ createUseWatchContractEvent({
    abi: ierc20MetadataAbi,
    eventName: 'Approval',
  })

/**
 * Wraps __{@link useWatchContractEvent}__ with `abi` set to __{@link ierc20MetadataAbi}__ and `eventName` set to `"Transfer"`
 */
export const useWatchIerc20MetadataTransferEvent =
  /*#__PURE__*/ createUseWatchContractEvent({
    abi: ierc20MetadataAbi,
    eventName: 'Transfer',
  })

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link mockErc20Abi}__
 */
export const useReadMockErc20 = /*#__PURE__*/ createUseReadContract({
  abi: mockErc20Abi,
})

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link mockErc20Abi}__ and `functionName` set to `"allowance"`
 */
export const useReadMockErc20Allowance = /*#__PURE__*/ createUseReadContract({
  abi: mockErc20Abi,
  functionName: 'allowance',
})

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link mockErc20Abi}__ and `functionName` set to `"balanceOf"`
 */
export const useReadMockErc20BalanceOf = /*#__PURE__*/ createUseReadContract({
  abi: mockErc20Abi,
  functionName: 'balanceOf',
})

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link mockErc20Abi}__ and `functionName` set to `"decimals"`
 */
export const useReadMockErc20Decimals = /*#__PURE__*/ createUseReadContract({
  abi: mockErc20Abi,
  functionName: 'decimals',
})

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link mockErc20Abi}__ and `functionName` set to `"name"`
 */
export const useReadMockErc20Name = /*#__PURE__*/ createUseReadContract({
  abi: mockErc20Abi,
  functionName: 'name',
})

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link mockErc20Abi}__ and `functionName` set to `"symbol"`
 */
export const useReadMockErc20Symbol = /*#__PURE__*/ createUseReadContract({
  abi: mockErc20Abi,
  functionName: 'symbol',
})

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link mockErc20Abi}__ and `functionName` set to `"totalSupply"`
 */
export const useReadMockErc20TotalSupply = /*#__PURE__*/ createUseReadContract({
  abi: mockErc20Abi,
  functionName: 'totalSupply',
})

/**
 * Wraps __{@link useWriteContract}__ with `abi` set to __{@link mockErc20Abi}__
 */
export const useWriteMockErc20 = /*#__PURE__*/ createUseWriteContract({
  abi: mockErc20Abi,
})

/**
 * Wraps __{@link useWriteContract}__ with `abi` set to __{@link mockErc20Abi}__ and `functionName` set to `"approve"`
 */
export const useWriteMockErc20Approve = /*#__PURE__*/ createUseWriteContract({
  abi: mockErc20Abi,
  functionName: 'approve',
})

/**
 * Wraps __{@link useWriteContract}__ with `abi` set to __{@link mockErc20Abi}__ and `functionName` set to `"mint"`
 */
export const useWriteMockErc20Mint = /*#__PURE__*/ createUseWriteContract({
  abi: mockErc20Abi,
  functionName: 'mint',
})

/**
 * Wraps __{@link useWriteContract}__ with `abi` set to __{@link mockErc20Abi}__ and `functionName` set to `"transfer"`
 */
export const useWriteMockErc20Transfer = /*#__PURE__*/ createUseWriteContract({
  abi: mockErc20Abi,
  functionName: 'transfer',
})

/**
 * Wraps __{@link useWriteContract}__ with `abi` set to __{@link mockErc20Abi}__ and `functionName` set to `"transferFrom"`
 */
export const useWriteMockErc20TransferFrom =
  /*#__PURE__*/ createUseWriteContract({
    abi: mockErc20Abi,
    functionName: 'transferFrom',
  })

/**
 * Wraps __{@link useSimulateContract}__ with `abi` set to __{@link mockErc20Abi}__
 */
export const useSimulateMockErc20 = /*#__PURE__*/ createUseSimulateContract({
  abi: mockErc20Abi,
})

/**
 * Wraps __{@link useSimulateContract}__ with `abi` set to __{@link mockErc20Abi}__ and `functionName` set to `"approve"`
 */
export const useSimulateMockErc20Approve =
  /*#__PURE__*/ createUseSimulateContract({
    abi: mockErc20Abi,
    functionName: 'approve',
  })

/**
 * Wraps __{@link useSimulateContract}__ with `abi` set to __{@link mockErc20Abi}__ and `functionName` set to `"mint"`
 */
export const useSimulateMockErc20Mint = /*#__PURE__*/ createUseSimulateContract(
  { abi: mockErc20Abi, functionName: 'mint' },
)

/**
 * Wraps __{@link useSimulateContract}__ with `abi` set to __{@link mockErc20Abi}__ and `functionName` set to `"transfer"`
 */
export const useSimulateMockErc20Transfer =
  /*#__PURE__*/ createUseSimulateContract({
    abi: mockErc20Abi,
    functionName: 'transfer',
  })

/**
 * Wraps __{@link useSimulateContract}__ with `abi` set to __{@link mockErc20Abi}__ and `functionName` set to `"transferFrom"`
 */
export const useSimulateMockErc20TransferFrom =
  /*#__PURE__*/ createUseSimulateContract({
    abi: mockErc20Abi,
    functionName: 'transferFrom',
  })

/**
 * Wraps __{@link useWatchContractEvent}__ with `abi` set to __{@link mockErc20Abi}__
 */
export const useWatchMockErc20Event = /*#__PURE__*/ createUseWatchContractEvent(
  { abi: mockErc20Abi },
)

/**
 * Wraps __{@link useWatchContractEvent}__ with `abi` set to __{@link mockErc20Abi}__ and `eventName` set to `"Approval"`
 */
export const useWatchMockErc20ApprovalEvent =
  /*#__PURE__*/ createUseWatchContractEvent({
    abi: mockErc20Abi,
    eventName: 'Approval',
  })

/**
 * Wraps __{@link useWatchContractEvent}__ with `abi` set to __{@link mockErc20Abi}__ and `eventName` set to `"Transfer"`
 */
export const useWatchMockErc20TransferEvent =
  /*#__PURE__*/ createUseWatchContractEvent({
    abi: mockErc20Abi,
    eventName: 'Transfer',
  })

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link ownableAbi}__
 */
export const useReadOwnable = /*#__PURE__*/ createUseReadContract({
  abi: ownableAbi,
})

/**
 * Wraps __{@link useReadContract}__ with `abi` set to __{@link ownableAbi}__ and `functionName` set to `"owner"`
 */
export const useReadOwnableOwner = /*#__PURE__*/ createUseReadContract({
  abi: ownableAbi,
  functionName: 'owner',
})

/**
 * Wraps __{@link useWriteContract}__ with `abi` set to __{@link ownableAbi}__
 */
export const useWriteOwnable = /*#__PURE__*/ createUseWriteContract({
  abi: ownableAbi,
})

/**
 * Wraps __{@link useWriteContract}__ with `abi` set to __{@link ownableAbi}__ and `functionName` set to `"renounceOwnership"`
 */
export const useWriteOwnableRenounceOwnership =
  /*#__PURE__*/ createUseWriteContract({
    abi: ownableAbi,
    functionName: 'renounceOwnership',
  })

/**
 * Wraps __{@link useWriteContract}__ with `abi` set to __{@link ownableAbi}__ and `functionName` set to `"transferOwnership"`
 */
export const useWriteOwnableTransferOwnership =
  /*#__PURE__*/ createUseWriteContract({
    abi: ownableAbi,
    functionName: 'transferOwnership',
  })

/**
 * Wraps __{@link useSimulateContract}__ with `abi` set to __{@link ownableAbi}__
 */
export const useSimulateOwnable = /*#__PURE__*/ createUseSimulateContract({
  abi: ownableAbi,
})

/**
 * Wraps __{@link useSimulateContract}__ with `abi` set to __{@link ownableAbi}__ and `functionName` set to `"renounceOwnership"`
 */
export const useSimulateOwnableRenounceOwnership =
  /*#__PURE__*/ createUseSimulateContract({
    abi: ownableAbi,
    functionName: 'renounceOwnership',
  })

/**
 * Wraps __{@link useSimulateContract}__ with `abi` set to __{@link ownableAbi}__ and `functionName` set to `"transferOwnership"`
 */
export const useSimulateOwnableTransferOwnership =
  /*#__PURE__*/ createUseSimulateContract({
    abi: ownableAbi,
    functionName: 'transferOwnership',
  })

/**
 * Wraps __{@link useWatchContractEvent}__ with `abi` set to __{@link ownableAbi}__
 */
export const useWatchOwnableEvent = /*#__PURE__*/ createUseWatchContractEvent({
  abi: ownableAbi,
})

/**
 * Wraps __{@link useWatchContractEvent}__ with `abi` set to __{@link ownableAbi}__ and `eventName` set to `"OwnershipTransferred"`
 */
export const useWatchOwnableOwnershipTransferredEvent =
  /*#__PURE__*/ createUseWatchContractEvent({
    abi: ownableAbi,
    eventName: 'OwnershipTransferred',
  })

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Action
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link contextRouterAbi}__
 *
 * - [__View Contract on Base Basescan__](https://basescan.org/address/0x676645eF4d3133181572622DABFaeC2170Db670B)
 * - [__View Contract on Base Sepolia Basescan__](https://sepolia.basescan.org/address/0x676645eF4d3133181572622DABFaeC2170Db670B)
 */
export const readContextRouter = /*#__PURE__*/ createReadContract({
  abi: contextRouterAbi,
  address: contextRouterAddress,
})

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link contextRouterAbi}__ and `functionName` set to `"PLATFORM_FEE_PERCENT"`
 *
 * - [__View Contract on Base Basescan__](https://basescan.org/address/0x676645eF4d3133181572622DABFaeC2170Db670B)
 * - [__View Contract on Base Sepolia Basescan__](https://sepolia.basescan.org/address/0x676645eF4d3133181572622DABFaeC2170Db670B)
 */
export const readContextRouterPlatformFeePercent =
  /*#__PURE__*/ createReadContract({
    abi: contextRouterAbi,
    address: contextRouterAddress,
    functionName: 'PLATFORM_FEE_PERCENT',
  })

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link contextRouterAbi}__ and `functionName` set to `"developerBalances"`
 *
 * - [__View Contract on Base Basescan__](https://basescan.org/address/0x676645eF4d3133181572622DABFaeC2170Db670B)
 * - [__View Contract on Base Sepolia Basescan__](https://sepolia.basescan.org/address/0x676645eF4d3133181572622DABFaeC2170Db670B)
 */
export const readContextRouterDeveloperBalances =
  /*#__PURE__*/ createReadContract({
    abi: contextRouterAbi,
    address: contextRouterAddress,
    functionName: 'developerBalances',
  })

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link contextRouterAbi}__ and `functionName` set to `"getPlatformBalance"`
 *
 * - [__View Contract on Base Basescan__](https://basescan.org/address/0x676645eF4d3133181572622DABFaeC2170Db670B)
 * - [__View Contract on Base Sepolia Basescan__](https://sepolia.basescan.org/address/0x676645eF4d3133181572622DABFaeC2170Db670B)
 */
export const readContextRouterGetPlatformBalance =
  /*#__PURE__*/ createReadContract({
    abi: contextRouterAbi,
    address: contextRouterAddress,
    functionName: 'getPlatformBalance',
  })

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link contextRouterAbi}__ and `functionName` set to `"getUnclaimedBalance"`
 *
 * - [__View Contract on Base Basescan__](https://basescan.org/address/0x676645eF4d3133181572622DABFaeC2170Db670B)
 * - [__View Contract on Base Sepolia Basescan__](https://sepolia.basescan.org/address/0x676645eF4d3133181572622DABFaeC2170Db670B)
 */
export const readContextRouterGetUnclaimedBalance =
  /*#__PURE__*/ createReadContract({
    abi: contextRouterAbi,
    address: contextRouterAddress,
    functionName: 'getUnclaimedBalance',
  })

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link contextRouterAbi}__ and `functionName` set to `"isOperator"`
 *
 * - [__View Contract on Base Basescan__](https://basescan.org/address/0x676645eF4d3133181572622DABFaeC2170Db670B)
 * - [__View Contract on Base Sepolia Basescan__](https://sepolia.basescan.org/address/0x676645eF4d3133181572622DABFaeC2170Db670B)
 */
export const readContextRouterIsOperator = /*#__PURE__*/ createReadContract({
  abi: contextRouterAbi,
  address: contextRouterAddress,
  functionName: 'isOperator',
})

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link contextRouterAbi}__ and `functionName` set to `"operators"`
 *
 * - [__View Contract on Base Basescan__](https://basescan.org/address/0x676645eF4d3133181572622DABFaeC2170Db670B)
 * - [__View Contract on Base Sepolia Basescan__](https://sepolia.basescan.org/address/0x676645eF4d3133181572622DABFaeC2170Db670B)
 */
export const readContextRouterOperators = /*#__PURE__*/ createReadContract({
  abi: contextRouterAbi,
  address: contextRouterAddress,
  functionName: 'operators',
})

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link contextRouterAbi}__ and `functionName` set to `"owner"`
 *
 * - [__View Contract on Base Basescan__](https://basescan.org/address/0x676645eF4d3133181572622DABFaeC2170Db670B)
 * - [__View Contract on Base Sepolia Basescan__](https://sepolia.basescan.org/address/0x676645eF4d3133181572622DABFaeC2170Db670B)
 */
export const readContextRouterOwner = /*#__PURE__*/ createReadContract({
  abi: contextRouterAbi,
  address: contextRouterAddress,
  functionName: 'owner',
})

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link contextRouterAbi}__ and `functionName` set to `"platformBalance"`
 *
 * - [__View Contract on Base Basescan__](https://basescan.org/address/0x676645eF4d3133181572622DABFaeC2170Db670B)
 * - [__View Contract on Base Sepolia Basescan__](https://sepolia.basescan.org/address/0x676645eF4d3133181572622DABFaeC2170Db670B)
 */
export const readContextRouterPlatformBalance =
  /*#__PURE__*/ createReadContract({
    abi: contextRouterAbi,
    address: contextRouterAddress,
    functionName: 'platformBalance',
  })

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link contextRouterAbi}__ and `functionName` set to `"usdc"`
 *
 * - [__View Contract on Base Basescan__](https://basescan.org/address/0x676645eF4d3133181572622DABFaeC2170Db670B)
 * - [__View Contract on Base Sepolia Basescan__](https://sepolia.basescan.org/address/0x676645eF4d3133181572622DABFaeC2170Db670B)
 */
export const readContextRouterUsdc = /*#__PURE__*/ createReadContract({
  abi: contextRouterAbi,
  address: contextRouterAddress,
  functionName: 'usdc',
})

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link contextRouterAbi}__
 *
 * - [__View Contract on Base Basescan__](https://basescan.org/address/0x676645eF4d3133181572622DABFaeC2170Db670B)
 * - [__View Contract on Base Sepolia Basescan__](https://sepolia.basescan.org/address/0x676645eF4d3133181572622DABFaeC2170Db670B)
 */
export const writeContextRouter = /*#__PURE__*/ createWriteContract({
  abi: contextRouterAbi,
  address: contextRouterAddress,
})

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link contextRouterAbi}__ and `functionName` set to `"addOperator"`
 *
 * - [__View Contract on Base Basescan__](https://basescan.org/address/0x676645eF4d3133181572622DABFaeC2170Db670B)
 * - [__View Contract on Base Sepolia Basescan__](https://sepolia.basescan.org/address/0x676645eF4d3133181572622DABFaeC2170Db670B)
 */
export const writeContextRouterAddOperator = /*#__PURE__*/ createWriteContract({
  abi: contextRouterAbi,
  address: contextRouterAddress,
  functionName: 'addOperator',
})

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link contextRouterAbi}__ and `functionName` set to `"claimEarnings"`
 *
 * - [__View Contract on Base Basescan__](https://basescan.org/address/0x676645eF4d3133181572622DABFaeC2170Db670B)
 * - [__View Contract on Base Sepolia Basescan__](https://sepolia.basescan.org/address/0x676645eF4d3133181572622DABFaeC2170Db670B)
 */
export const writeContextRouterClaimEarnings =
  /*#__PURE__*/ createWriteContract({
    abi: contextRouterAbi,
    address: contextRouterAddress,
    functionName: 'claimEarnings',
  })

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link contextRouterAbi}__ and `functionName` set to `"claimPlatformFees"`
 *
 * - [__View Contract on Base Basescan__](https://basescan.org/address/0x676645eF4d3133181572622DABFaeC2170Db670B)
 * - [__View Contract on Base Sepolia Basescan__](https://sepolia.basescan.org/address/0x676645eF4d3133181572622DABFaeC2170Db670B)
 */
export const writeContextRouterClaimPlatformFees =
  /*#__PURE__*/ createWriteContract({
    abi: contextRouterAbi,
    address: contextRouterAddress,
    functionName: 'claimPlatformFees',
  })

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link contextRouterAbi}__ and `functionName` set to `"executeBatchPaidQuery"`
 *
 * - [__View Contract on Base Basescan__](https://basescan.org/address/0x676645eF4d3133181572622DABFaeC2170Db670B)
 * - [__View Contract on Base Sepolia Basescan__](https://sepolia.basescan.org/address/0x676645eF4d3133181572622DABFaeC2170Db670B)
 */
export const writeContextRouterExecuteBatchPaidQuery =
  /*#__PURE__*/ createWriteContract({
    abi: contextRouterAbi,
    address: contextRouterAddress,
    functionName: 'executeBatchPaidQuery',
  })

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link contextRouterAbi}__ and `functionName` set to `"executeBatchPaidQueryFor"`
 *
 * - [__View Contract on Base Basescan__](https://basescan.org/address/0x676645eF4d3133181572622DABFaeC2170Db670B)
 * - [__View Contract on Base Sepolia Basescan__](https://sepolia.basescan.org/address/0x676645eF4d3133181572622DABFaeC2170Db670B)
 */
export const writeContextRouterExecuteBatchPaidQueryFor =
  /*#__PURE__*/ createWriteContract({
    abi: contextRouterAbi,
    address: contextRouterAddress,
    functionName: 'executeBatchPaidQueryFor',
  })

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link contextRouterAbi}__ and `functionName` set to `"executePaidQuery"`
 *
 * - [__View Contract on Base Basescan__](https://basescan.org/address/0x676645eF4d3133181572622DABFaeC2170Db670B)
 * - [__View Contract on Base Sepolia Basescan__](https://sepolia.basescan.org/address/0x676645eF4d3133181572622DABFaeC2170Db670B)
 */
export const writeContextRouterExecutePaidQuery =
  /*#__PURE__*/ createWriteContract({
    abi: contextRouterAbi,
    address: contextRouterAddress,
    functionName: 'executePaidQuery',
  })

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link contextRouterAbi}__ and `functionName` set to `"executePaidQueryFor"`
 *
 * - [__View Contract on Base Basescan__](https://basescan.org/address/0x676645eF4d3133181572622DABFaeC2170Db670B)
 * - [__View Contract on Base Sepolia Basescan__](https://sepolia.basescan.org/address/0x676645eF4d3133181572622DABFaeC2170Db670B)
 */
export const writeContextRouterExecutePaidQueryFor =
  /*#__PURE__*/ createWriteContract({
    abi: contextRouterAbi,
    address: contextRouterAddress,
    functionName: 'executePaidQueryFor',
  })

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link contextRouterAbi}__ and `functionName` set to `"executeQueryWithModelCost"`
 *
 * - [__View Contract on Base Basescan__](https://basescan.org/address/0x676645eF4d3133181572622DABFaeC2170Db670B)
 * - [__View Contract on Base Sepolia Basescan__](https://sepolia.basescan.org/address/0x676645eF4d3133181572622DABFaeC2170Db670B)
 */
export const writeContextRouterExecuteQueryWithModelCost =
  /*#__PURE__*/ createWriteContract({
    abi: contextRouterAbi,
    address: contextRouterAddress,
    functionName: 'executeQueryWithModelCost',
  })

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link contextRouterAbi}__ and `functionName` set to `"executeQueryWithModelCostFor"`
 *
 * - [__View Contract on Base Basescan__](https://basescan.org/address/0x676645eF4d3133181572622DABFaeC2170Db670B)
 * - [__View Contract on Base Sepolia Basescan__](https://sepolia.basescan.org/address/0x676645eF4d3133181572622DABFaeC2170Db670B)
 */
export const writeContextRouterExecuteQueryWithModelCostFor =
  /*#__PURE__*/ createWriteContract({
    abi: contextRouterAbi,
    address: contextRouterAddress,
    functionName: 'executeQueryWithModelCostFor',
  })

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link contextRouterAbi}__ and `functionName` set to `"removeOperator"`
 *
 * - [__View Contract on Base Basescan__](https://basescan.org/address/0x676645eF4d3133181572622DABFaeC2170Db670B)
 * - [__View Contract on Base Sepolia Basescan__](https://sepolia.basescan.org/address/0x676645eF4d3133181572622DABFaeC2170Db670B)
 */
export const writeContextRouterRemoveOperator =
  /*#__PURE__*/ createWriteContract({
    abi: contextRouterAbi,
    address: contextRouterAddress,
    functionName: 'removeOperator',
  })

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link contextRouterAbi}__ and `functionName` set to `"renounceOwnership"`
 *
 * - [__View Contract on Base Basescan__](https://basescan.org/address/0x676645eF4d3133181572622DABFaeC2170Db670B)
 * - [__View Contract on Base Sepolia Basescan__](https://sepolia.basescan.org/address/0x676645eF4d3133181572622DABFaeC2170Db670B)
 */
export const writeContextRouterRenounceOwnership =
  /*#__PURE__*/ createWriteContract({
    abi: contextRouterAbi,
    address: contextRouterAddress,
    functionName: 'renounceOwnership',
  })

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link contextRouterAbi}__ and `functionName` set to `"transferOwnership"`
 *
 * - [__View Contract on Base Basescan__](https://basescan.org/address/0x676645eF4d3133181572622DABFaeC2170Db670B)
 * - [__View Contract on Base Sepolia Basescan__](https://sepolia.basescan.org/address/0x676645eF4d3133181572622DABFaeC2170Db670B)
 */
export const writeContextRouterTransferOwnership =
  /*#__PURE__*/ createWriteContract({
    abi: contextRouterAbi,
    address: contextRouterAddress,
    functionName: 'transferOwnership',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link contextRouterAbi}__
 *
 * - [__View Contract on Base Basescan__](https://basescan.org/address/0x676645eF4d3133181572622DABFaeC2170Db670B)
 * - [__View Contract on Base Sepolia Basescan__](https://sepolia.basescan.org/address/0x676645eF4d3133181572622DABFaeC2170Db670B)
 */
export const simulateContextRouter = /*#__PURE__*/ createSimulateContract({
  abi: contextRouterAbi,
  address: contextRouterAddress,
})

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link contextRouterAbi}__ and `functionName` set to `"addOperator"`
 *
 * - [__View Contract on Base Basescan__](https://basescan.org/address/0x676645eF4d3133181572622DABFaeC2170Db670B)
 * - [__View Contract on Base Sepolia Basescan__](https://sepolia.basescan.org/address/0x676645eF4d3133181572622DABFaeC2170Db670B)
 */
export const simulateContextRouterAddOperator =
  /*#__PURE__*/ createSimulateContract({
    abi: contextRouterAbi,
    address: contextRouterAddress,
    functionName: 'addOperator',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link contextRouterAbi}__ and `functionName` set to `"claimEarnings"`
 *
 * - [__View Contract on Base Basescan__](https://basescan.org/address/0x676645eF4d3133181572622DABFaeC2170Db670B)
 * - [__View Contract on Base Sepolia Basescan__](https://sepolia.basescan.org/address/0x676645eF4d3133181572622DABFaeC2170Db670B)
 */
export const simulateContextRouterClaimEarnings =
  /*#__PURE__*/ createSimulateContract({
    abi: contextRouterAbi,
    address: contextRouterAddress,
    functionName: 'claimEarnings',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link contextRouterAbi}__ and `functionName` set to `"claimPlatformFees"`
 *
 * - [__View Contract on Base Basescan__](https://basescan.org/address/0x676645eF4d3133181572622DABFaeC2170Db670B)
 * - [__View Contract on Base Sepolia Basescan__](https://sepolia.basescan.org/address/0x676645eF4d3133181572622DABFaeC2170Db670B)
 */
export const simulateContextRouterClaimPlatformFees =
  /*#__PURE__*/ createSimulateContract({
    abi: contextRouterAbi,
    address: contextRouterAddress,
    functionName: 'claimPlatformFees',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link contextRouterAbi}__ and `functionName` set to `"executeBatchPaidQuery"`
 *
 * - [__View Contract on Base Basescan__](https://basescan.org/address/0x676645eF4d3133181572622DABFaeC2170Db670B)
 * - [__View Contract on Base Sepolia Basescan__](https://sepolia.basescan.org/address/0x676645eF4d3133181572622DABFaeC2170Db670B)
 */
export const simulateContextRouterExecuteBatchPaidQuery =
  /*#__PURE__*/ createSimulateContract({
    abi: contextRouterAbi,
    address: contextRouterAddress,
    functionName: 'executeBatchPaidQuery',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link contextRouterAbi}__ and `functionName` set to `"executeBatchPaidQueryFor"`
 *
 * - [__View Contract on Base Basescan__](https://basescan.org/address/0x676645eF4d3133181572622DABFaeC2170Db670B)
 * - [__View Contract on Base Sepolia Basescan__](https://sepolia.basescan.org/address/0x676645eF4d3133181572622DABFaeC2170Db670B)
 */
export const simulateContextRouterExecuteBatchPaidQueryFor =
  /*#__PURE__*/ createSimulateContract({
    abi: contextRouterAbi,
    address: contextRouterAddress,
    functionName: 'executeBatchPaidQueryFor',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link contextRouterAbi}__ and `functionName` set to `"executePaidQuery"`
 *
 * - [__View Contract on Base Basescan__](https://basescan.org/address/0x676645eF4d3133181572622DABFaeC2170Db670B)
 * - [__View Contract on Base Sepolia Basescan__](https://sepolia.basescan.org/address/0x676645eF4d3133181572622DABFaeC2170Db670B)
 */
export const simulateContextRouterExecutePaidQuery =
  /*#__PURE__*/ createSimulateContract({
    abi: contextRouterAbi,
    address: contextRouterAddress,
    functionName: 'executePaidQuery',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link contextRouterAbi}__ and `functionName` set to `"executePaidQueryFor"`
 *
 * - [__View Contract on Base Basescan__](https://basescan.org/address/0x676645eF4d3133181572622DABFaeC2170Db670B)
 * - [__View Contract on Base Sepolia Basescan__](https://sepolia.basescan.org/address/0x676645eF4d3133181572622DABFaeC2170Db670B)
 */
export const simulateContextRouterExecutePaidQueryFor =
  /*#__PURE__*/ createSimulateContract({
    abi: contextRouterAbi,
    address: contextRouterAddress,
    functionName: 'executePaidQueryFor',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link contextRouterAbi}__ and `functionName` set to `"executeQueryWithModelCost"`
 *
 * - [__View Contract on Base Basescan__](https://basescan.org/address/0x676645eF4d3133181572622DABFaeC2170Db670B)
 * - [__View Contract on Base Sepolia Basescan__](https://sepolia.basescan.org/address/0x676645eF4d3133181572622DABFaeC2170Db670B)
 */
export const simulateContextRouterExecuteQueryWithModelCost =
  /*#__PURE__*/ createSimulateContract({
    abi: contextRouterAbi,
    address: contextRouterAddress,
    functionName: 'executeQueryWithModelCost',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link contextRouterAbi}__ and `functionName` set to `"executeQueryWithModelCostFor"`
 *
 * - [__View Contract on Base Basescan__](https://basescan.org/address/0x676645eF4d3133181572622DABFaeC2170Db670B)
 * - [__View Contract on Base Sepolia Basescan__](https://sepolia.basescan.org/address/0x676645eF4d3133181572622DABFaeC2170Db670B)
 */
export const simulateContextRouterExecuteQueryWithModelCostFor =
  /*#__PURE__*/ createSimulateContract({
    abi: contextRouterAbi,
    address: contextRouterAddress,
    functionName: 'executeQueryWithModelCostFor',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link contextRouterAbi}__ and `functionName` set to `"removeOperator"`
 *
 * - [__View Contract on Base Basescan__](https://basescan.org/address/0x676645eF4d3133181572622DABFaeC2170Db670B)
 * - [__View Contract on Base Sepolia Basescan__](https://sepolia.basescan.org/address/0x676645eF4d3133181572622DABFaeC2170Db670B)
 */
export const simulateContextRouterRemoveOperator =
  /*#__PURE__*/ createSimulateContract({
    abi: contextRouterAbi,
    address: contextRouterAddress,
    functionName: 'removeOperator',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link contextRouterAbi}__ and `functionName` set to `"renounceOwnership"`
 *
 * - [__View Contract on Base Basescan__](https://basescan.org/address/0x676645eF4d3133181572622DABFaeC2170Db670B)
 * - [__View Contract on Base Sepolia Basescan__](https://sepolia.basescan.org/address/0x676645eF4d3133181572622DABFaeC2170Db670B)
 */
export const simulateContextRouterRenounceOwnership =
  /*#__PURE__*/ createSimulateContract({
    abi: contextRouterAbi,
    address: contextRouterAddress,
    functionName: 'renounceOwnership',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link contextRouterAbi}__ and `functionName` set to `"transferOwnership"`
 *
 * - [__View Contract on Base Basescan__](https://basescan.org/address/0x676645eF4d3133181572622DABFaeC2170Db670B)
 * - [__View Contract on Base Sepolia Basescan__](https://sepolia.basescan.org/address/0x676645eF4d3133181572622DABFaeC2170Db670B)
 */
export const simulateContextRouterTransferOwnership =
  /*#__PURE__*/ createSimulateContract({
    abi: contextRouterAbi,
    address: contextRouterAddress,
    functionName: 'transferOwnership',
  })

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link contextRouterAbi}__
 *
 * - [__View Contract on Base Basescan__](https://basescan.org/address/0x676645eF4d3133181572622DABFaeC2170Db670B)
 * - [__View Contract on Base Sepolia Basescan__](https://sepolia.basescan.org/address/0x676645eF4d3133181572622DABFaeC2170Db670B)
 */
export const watchContextRouterEvent = /*#__PURE__*/ createWatchContractEvent({
  abi: contextRouterAbi,
  address: contextRouterAddress,
})

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link contextRouterAbi}__ and `eventName` set to `"EarningsClaimed"`
 *
 * - [__View Contract on Base Basescan__](https://basescan.org/address/0x676645eF4d3133181572622DABFaeC2170Db670B)
 * - [__View Contract on Base Sepolia Basescan__](https://sepolia.basescan.org/address/0x676645eF4d3133181572622DABFaeC2170Db670B)
 */
export const watchContextRouterEarningsClaimedEvent =
  /*#__PURE__*/ createWatchContractEvent({
    abi: contextRouterAbi,
    address: contextRouterAddress,
    eventName: 'EarningsClaimed',
  })

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link contextRouterAbi}__ and `eventName` set to `"ModelCostPaid"`
 *
 * - [__View Contract on Base Basescan__](https://basescan.org/address/0x676645eF4d3133181572622DABFaeC2170Db670B)
 * - [__View Contract on Base Sepolia Basescan__](https://sepolia.basescan.org/address/0x676645eF4d3133181572622DABFaeC2170Db670B)
 */
export const watchContextRouterModelCostPaidEvent =
  /*#__PURE__*/ createWatchContractEvent({
    abi: contextRouterAbi,
    address: contextRouterAddress,
    eventName: 'ModelCostPaid',
  })

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link contextRouterAbi}__ and `eventName` set to `"OperatorAdded"`
 *
 * - [__View Contract on Base Basescan__](https://basescan.org/address/0x676645eF4d3133181572622DABFaeC2170Db670B)
 * - [__View Contract on Base Sepolia Basescan__](https://sepolia.basescan.org/address/0x676645eF4d3133181572622DABFaeC2170Db670B)
 */
export const watchContextRouterOperatorAddedEvent =
  /*#__PURE__*/ createWatchContractEvent({
    abi: contextRouterAbi,
    address: contextRouterAddress,
    eventName: 'OperatorAdded',
  })

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link contextRouterAbi}__ and `eventName` set to `"OperatorRemoved"`
 *
 * - [__View Contract on Base Basescan__](https://basescan.org/address/0x676645eF4d3133181572622DABFaeC2170Db670B)
 * - [__View Contract on Base Sepolia Basescan__](https://sepolia.basescan.org/address/0x676645eF4d3133181572622DABFaeC2170Db670B)
 */
export const watchContextRouterOperatorRemovedEvent =
  /*#__PURE__*/ createWatchContractEvent({
    abi: contextRouterAbi,
    address: contextRouterAddress,
    eventName: 'OperatorRemoved',
  })

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link contextRouterAbi}__ and `eventName` set to `"OwnershipTransferred"`
 *
 * - [__View Contract on Base Basescan__](https://basescan.org/address/0x676645eF4d3133181572622DABFaeC2170Db670B)
 * - [__View Contract on Base Sepolia Basescan__](https://sepolia.basescan.org/address/0x676645eF4d3133181572622DABFaeC2170Db670B)
 */
export const watchContextRouterOwnershipTransferredEvent =
  /*#__PURE__*/ createWatchContractEvent({
    abi: contextRouterAbi,
    address: contextRouterAddress,
    eventName: 'OwnershipTransferred',
  })

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link contextRouterAbi}__ and `eventName` set to `"PlatformFeesClaimed"`
 *
 * - [__View Contract on Base Basescan__](https://basescan.org/address/0x676645eF4d3133181572622DABFaeC2170Db670B)
 * - [__View Contract on Base Sepolia Basescan__](https://sepolia.basescan.org/address/0x676645eF4d3133181572622DABFaeC2170Db670B)
 */
export const watchContextRouterPlatformFeesClaimedEvent =
  /*#__PURE__*/ createWatchContractEvent({
    abi: contextRouterAbi,
    address: contextRouterAddress,
    eventName: 'PlatformFeesClaimed',
  })

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link contextRouterAbi}__ and `eventName` set to `"QueryPaid"`
 *
 * - [__View Contract on Base Basescan__](https://basescan.org/address/0x676645eF4d3133181572622DABFaeC2170Db670B)
 * - [__View Contract on Base Sepolia Basescan__](https://sepolia.basescan.org/address/0x676645eF4d3133181572622DABFaeC2170Db670B)
 */
export const watchContextRouterQueryPaidEvent =
  /*#__PURE__*/ createWatchContractEvent({
    abi: contextRouterAbi,
    address: contextRouterAddress,
    eventName: 'QueryPaid',
  })

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link erc20Abi}__
 */
export const readErc20 = /*#__PURE__*/ createReadContract({ abi: erc20Abi })

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link erc20Abi}__ and `functionName` set to `"allowance"`
 */
export const readErc20Allowance = /*#__PURE__*/ createReadContract({
  abi: erc20Abi,
  functionName: 'allowance',
})

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link erc20Abi}__ and `functionName` set to `"balanceOf"`
 */
export const readErc20BalanceOf = /*#__PURE__*/ createReadContract({
  abi: erc20Abi,
  functionName: 'balanceOf',
})

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link erc20Abi}__ and `functionName` set to `"decimals"`
 */
export const readErc20Decimals = /*#__PURE__*/ createReadContract({
  abi: erc20Abi,
  functionName: 'decimals',
})

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link erc20Abi}__ and `functionName` set to `"name"`
 */
export const readErc20Name = /*#__PURE__*/ createReadContract({
  abi: erc20Abi,
  functionName: 'name',
})

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link erc20Abi}__ and `functionName` set to `"symbol"`
 */
export const readErc20Symbol = /*#__PURE__*/ createReadContract({
  abi: erc20Abi,
  functionName: 'symbol',
})

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link erc20Abi}__ and `functionName` set to `"totalSupply"`
 */
export const readErc20TotalSupply = /*#__PURE__*/ createReadContract({
  abi: erc20Abi,
  functionName: 'totalSupply',
})

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link erc20Abi}__
 */
export const writeErc20 = /*#__PURE__*/ createWriteContract({ abi: erc20Abi })

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link erc20Abi}__ and `functionName` set to `"approve"`
 */
export const writeErc20Approve = /*#__PURE__*/ createWriteContract({
  abi: erc20Abi,
  functionName: 'approve',
})

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link erc20Abi}__ and `functionName` set to `"transfer"`
 */
export const writeErc20Transfer = /*#__PURE__*/ createWriteContract({
  abi: erc20Abi,
  functionName: 'transfer',
})

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link erc20Abi}__ and `functionName` set to `"transferFrom"`
 */
export const writeErc20TransferFrom = /*#__PURE__*/ createWriteContract({
  abi: erc20Abi,
  functionName: 'transferFrom',
})

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link erc20Abi}__
 */
export const simulateErc20 = /*#__PURE__*/ createSimulateContract({
  abi: erc20Abi,
})

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link erc20Abi}__ and `functionName` set to `"approve"`
 */
export const simulateErc20Approve = /*#__PURE__*/ createSimulateContract({
  abi: erc20Abi,
  functionName: 'approve',
})

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link erc20Abi}__ and `functionName` set to `"transfer"`
 */
export const simulateErc20Transfer = /*#__PURE__*/ createSimulateContract({
  abi: erc20Abi,
  functionName: 'transfer',
})

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link erc20Abi}__ and `functionName` set to `"transferFrom"`
 */
export const simulateErc20TransferFrom = /*#__PURE__*/ createSimulateContract({
  abi: erc20Abi,
  functionName: 'transferFrom',
})

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link erc20Abi}__
 */
export const watchErc20Event = /*#__PURE__*/ createWatchContractEvent({
  abi: erc20Abi,
})

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link erc20Abi}__ and `eventName` set to `"Approval"`
 */
export const watchErc20ApprovalEvent = /*#__PURE__*/ createWatchContractEvent({
  abi: erc20Abi,
  eventName: 'Approval',
})

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link erc20Abi}__ and `eventName` set to `"Transfer"`
 */
export const watchErc20TransferEvent = /*#__PURE__*/ createWatchContractEvent({
  abi: erc20Abi,
  eventName: 'Transfer',
})

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link ierc1363Abi}__
 */
export const readIerc1363 = /*#__PURE__*/ createReadContract({
  abi: ierc1363Abi,
})

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link ierc1363Abi}__ and `functionName` set to `"allowance"`
 */
export const readIerc1363Allowance = /*#__PURE__*/ createReadContract({
  abi: ierc1363Abi,
  functionName: 'allowance',
})

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link ierc1363Abi}__ and `functionName` set to `"balanceOf"`
 */
export const readIerc1363BalanceOf = /*#__PURE__*/ createReadContract({
  abi: ierc1363Abi,
  functionName: 'balanceOf',
})

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link ierc1363Abi}__ and `functionName` set to `"supportsInterface"`
 */
export const readIerc1363SupportsInterface = /*#__PURE__*/ createReadContract({
  abi: ierc1363Abi,
  functionName: 'supportsInterface',
})

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link ierc1363Abi}__ and `functionName` set to `"totalSupply"`
 */
export const readIerc1363TotalSupply = /*#__PURE__*/ createReadContract({
  abi: ierc1363Abi,
  functionName: 'totalSupply',
})

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link ierc1363Abi}__
 */
export const writeIerc1363 = /*#__PURE__*/ createWriteContract({
  abi: ierc1363Abi,
})

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link ierc1363Abi}__ and `functionName` set to `"approve"`
 */
export const writeIerc1363Approve = /*#__PURE__*/ createWriteContract({
  abi: ierc1363Abi,
  functionName: 'approve',
})

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link ierc1363Abi}__ and `functionName` set to `"approveAndCall"`
 */
export const writeIerc1363ApproveAndCall = /*#__PURE__*/ createWriteContract({
  abi: ierc1363Abi,
  functionName: 'approveAndCall',
})

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link ierc1363Abi}__ and `functionName` set to `"transfer"`
 */
export const writeIerc1363Transfer = /*#__PURE__*/ createWriteContract({
  abi: ierc1363Abi,
  functionName: 'transfer',
})

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link ierc1363Abi}__ and `functionName` set to `"transferAndCall"`
 */
export const writeIerc1363TransferAndCall = /*#__PURE__*/ createWriteContract({
  abi: ierc1363Abi,
  functionName: 'transferAndCall',
})

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link ierc1363Abi}__ and `functionName` set to `"transferFrom"`
 */
export const writeIerc1363TransferFrom = /*#__PURE__*/ createWriteContract({
  abi: ierc1363Abi,
  functionName: 'transferFrom',
})

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link ierc1363Abi}__ and `functionName` set to `"transferFromAndCall"`
 */
export const writeIerc1363TransferFromAndCall =
  /*#__PURE__*/ createWriteContract({
    abi: ierc1363Abi,
    functionName: 'transferFromAndCall',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link ierc1363Abi}__
 */
export const simulateIerc1363 = /*#__PURE__*/ createSimulateContract({
  abi: ierc1363Abi,
})

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link ierc1363Abi}__ and `functionName` set to `"approve"`
 */
export const simulateIerc1363Approve = /*#__PURE__*/ createSimulateContract({
  abi: ierc1363Abi,
  functionName: 'approve',
})

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link ierc1363Abi}__ and `functionName` set to `"approveAndCall"`
 */
export const simulateIerc1363ApproveAndCall =
  /*#__PURE__*/ createSimulateContract({
    abi: ierc1363Abi,
    functionName: 'approveAndCall',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link ierc1363Abi}__ and `functionName` set to `"transfer"`
 */
export const simulateIerc1363Transfer = /*#__PURE__*/ createSimulateContract({
  abi: ierc1363Abi,
  functionName: 'transfer',
})

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link ierc1363Abi}__ and `functionName` set to `"transferAndCall"`
 */
export const simulateIerc1363TransferAndCall =
  /*#__PURE__*/ createSimulateContract({
    abi: ierc1363Abi,
    functionName: 'transferAndCall',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link ierc1363Abi}__ and `functionName` set to `"transferFrom"`
 */
export const simulateIerc1363TransferFrom =
  /*#__PURE__*/ createSimulateContract({
    abi: ierc1363Abi,
    functionName: 'transferFrom',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link ierc1363Abi}__ and `functionName` set to `"transferFromAndCall"`
 */
export const simulateIerc1363TransferFromAndCall =
  /*#__PURE__*/ createSimulateContract({
    abi: ierc1363Abi,
    functionName: 'transferFromAndCall',
  })

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link ierc1363Abi}__
 */
export const watchIerc1363Event = /*#__PURE__*/ createWatchContractEvent({
  abi: ierc1363Abi,
})

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link ierc1363Abi}__ and `eventName` set to `"Approval"`
 */
export const watchIerc1363ApprovalEvent =
  /*#__PURE__*/ createWatchContractEvent({
    abi: ierc1363Abi,
    eventName: 'Approval',
  })

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link ierc1363Abi}__ and `eventName` set to `"Transfer"`
 */
export const watchIerc1363TransferEvent =
  /*#__PURE__*/ createWatchContractEvent({
    abi: ierc1363Abi,
    eventName: 'Transfer',
  })

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link ierc165Abi}__
 */
export const readIerc165 = /*#__PURE__*/ createReadContract({ abi: ierc165Abi })

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link ierc165Abi}__ and `functionName` set to `"supportsInterface"`
 */
export const readIerc165SupportsInterface = /*#__PURE__*/ createReadContract({
  abi: ierc165Abi,
  functionName: 'supportsInterface',
})

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link ierc20Abi}__
 */
export const readIerc20 = /*#__PURE__*/ createReadContract({ abi: ierc20Abi })

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link ierc20Abi}__ and `functionName` set to `"allowance"`
 */
export const readIerc20Allowance = /*#__PURE__*/ createReadContract({
  abi: ierc20Abi,
  functionName: 'allowance',
})

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link ierc20Abi}__ and `functionName` set to `"balanceOf"`
 */
export const readIerc20BalanceOf = /*#__PURE__*/ createReadContract({
  abi: ierc20Abi,
  functionName: 'balanceOf',
})

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link ierc20Abi}__ and `functionName` set to `"totalSupply"`
 */
export const readIerc20TotalSupply = /*#__PURE__*/ createReadContract({
  abi: ierc20Abi,
  functionName: 'totalSupply',
})

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link ierc20Abi}__
 */
export const writeIerc20 = /*#__PURE__*/ createWriteContract({ abi: ierc20Abi })

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link ierc20Abi}__ and `functionName` set to `"approve"`
 */
export const writeIerc20Approve = /*#__PURE__*/ createWriteContract({
  abi: ierc20Abi,
  functionName: 'approve',
})

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link ierc20Abi}__ and `functionName` set to `"transfer"`
 */
export const writeIerc20Transfer = /*#__PURE__*/ createWriteContract({
  abi: ierc20Abi,
  functionName: 'transfer',
})

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link ierc20Abi}__ and `functionName` set to `"transferFrom"`
 */
export const writeIerc20TransferFrom = /*#__PURE__*/ createWriteContract({
  abi: ierc20Abi,
  functionName: 'transferFrom',
})

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link ierc20Abi}__
 */
export const simulateIerc20 = /*#__PURE__*/ createSimulateContract({
  abi: ierc20Abi,
})

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link ierc20Abi}__ and `functionName` set to `"approve"`
 */
export const simulateIerc20Approve = /*#__PURE__*/ createSimulateContract({
  abi: ierc20Abi,
  functionName: 'approve',
})

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link ierc20Abi}__ and `functionName` set to `"transfer"`
 */
export const simulateIerc20Transfer = /*#__PURE__*/ createSimulateContract({
  abi: ierc20Abi,
  functionName: 'transfer',
})

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link ierc20Abi}__ and `functionName` set to `"transferFrom"`
 */
export const simulateIerc20TransferFrom = /*#__PURE__*/ createSimulateContract({
  abi: ierc20Abi,
  functionName: 'transferFrom',
})

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link ierc20Abi}__
 */
export const watchIerc20Event = /*#__PURE__*/ createWatchContractEvent({
  abi: ierc20Abi,
})

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link ierc20Abi}__ and `eventName` set to `"Approval"`
 */
export const watchIerc20ApprovalEvent = /*#__PURE__*/ createWatchContractEvent({
  abi: ierc20Abi,
  eventName: 'Approval',
})

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link ierc20Abi}__ and `eventName` set to `"Transfer"`
 */
export const watchIerc20TransferEvent = /*#__PURE__*/ createWatchContractEvent({
  abi: ierc20Abi,
  eventName: 'Transfer',
})

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link ierc20MetadataAbi}__
 */
export const readIerc20Metadata = /*#__PURE__*/ createReadContract({
  abi: ierc20MetadataAbi,
})

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link ierc20MetadataAbi}__ and `functionName` set to `"allowance"`
 */
export const readIerc20MetadataAllowance = /*#__PURE__*/ createReadContract({
  abi: ierc20MetadataAbi,
  functionName: 'allowance',
})

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link ierc20MetadataAbi}__ and `functionName` set to `"balanceOf"`
 */
export const readIerc20MetadataBalanceOf = /*#__PURE__*/ createReadContract({
  abi: ierc20MetadataAbi,
  functionName: 'balanceOf',
})

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link ierc20MetadataAbi}__ and `functionName` set to `"decimals"`
 */
export const readIerc20MetadataDecimals = /*#__PURE__*/ createReadContract({
  abi: ierc20MetadataAbi,
  functionName: 'decimals',
})

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link ierc20MetadataAbi}__ and `functionName` set to `"name"`
 */
export const readIerc20MetadataName = /*#__PURE__*/ createReadContract({
  abi: ierc20MetadataAbi,
  functionName: 'name',
})

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link ierc20MetadataAbi}__ and `functionName` set to `"symbol"`
 */
export const readIerc20MetadataSymbol = /*#__PURE__*/ createReadContract({
  abi: ierc20MetadataAbi,
  functionName: 'symbol',
})

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link ierc20MetadataAbi}__ and `functionName` set to `"totalSupply"`
 */
export const readIerc20MetadataTotalSupply = /*#__PURE__*/ createReadContract({
  abi: ierc20MetadataAbi,
  functionName: 'totalSupply',
})

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link ierc20MetadataAbi}__
 */
export const writeIerc20Metadata = /*#__PURE__*/ createWriteContract({
  abi: ierc20MetadataAbi,
})

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link ierc20MetadataAbi}__ and `functionName` set to `"approve"`
 */
export const writeIerc20MetadataApprove = /*#__PURE__*/ createWriteContract({
  abi: ierc20MetadataAbi,
  functionName: 'approve',
})

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link ierc20MetadataAbi}__ and `functionName` set to `"transfer"`
 */
export const writeIerc20MetadataTransfer = /*#__PURE__*/ createWriteContract({
  abi: ierc20MetadataAbi,
  functionName: 'transfer',
})

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link ierc20MetadataAbi}__ and `functionName` set to `"transferFrom"`
 */
export const writeIerc20MetadataTransferFrom =
  /*#__PURE__*/ createWriteContract({
    abi: ierc20MetadataAbi,
    functionName: 'transferFrom',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link ierc20MetadataAbi}__
 */
export const simulateIerc20Metadata = /*#__PURE__*/ createSimulateContract({
  abi: ierc20MetadataAbi,
})

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link ierc20MetadataAbi}__ and `functionName` set to `"approve"`
 */
export const simulateIerc20MetadataApprove =
  /*#__PURE__*/ createSimulateContract({
    abi: ierc20MetadataAbi,
    functionName: 'approve',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link ierc20MetadataAbi}__ and `functionName` set to `"transfer"`
 */
export const simulateIerc20MetadataTransfer =
  /*#__PURE__*/ createSimulateContract({
    abi: ierc20MetadataAbi,
    functionName: 'transfer',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link ierc20MetadataAbi}__ and `functionName` set to `"transferFrom"`
 */
export const simulateIerc20MetadataTransferFrom =
  /*#__PURE__*/ createSimulateContract({
    abi: ierc20MetadataAbi,
    functionName: 'transferFrom',
  })

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link ierc20MetadataAbi}__
 */
export const watchIerc20MetadataEvent = /*#__PURE__*/ createWatchContractEvent({
  abi: ierc20MetadataAbi,
})

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link ierc20MetadataAbi}__ and `eventName` set to `"Approval"`
 */
export const watchIerc20MetadataApprovalEvent =
  /*#__PURE__*/ createWatchContractEvent({
    abi: ierc20MetadataAbi,
    eventName: 'Approval',
  })

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link ierc20MetadataAbi}__ and `eventName` set to `"Transfer"`
 */
export const watchIerc20MetadataTransferEvent =
  /*#__PURE__*/ createWatchContractEvent({
    abi: ierc20MetadataAbi,
    eventName: 'Transfer',
  })

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link mockErc20Abi}__
 */
export const readMockErc20 = /*#__PURE__*/ createReadContract({
  abi: mockErc20Abi,
})

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link mockErc20Abi}__ and `functionName` set to `"allowance"`
 */
export const readMockErc20Allowance = /*#__PURE__*/ createReadContract({
  abi: mockErc20Abi,
  functionName: 'allowance',
})

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link mockErc20Abi}__ and `functionName` set to `"balanceOf"`
 */
export const readMockErc20BalanceOf = /*#__PURE__*/ createReadContract({
  abi: mockErc20Abi,
  functionName: 'balanceOf',
})

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link mockErc20Abi}__ and `functionName` set to `"decimals"`
 */
export const readMockErc20Decimals = /*#__PURE__*/ createReadContract({
  abi: mockErc20Abi,
  functionName: 'decimals',
})

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link mockErc20Abi}__ and `functionName` set to `"name"`
 */
export const readMockErc20Name = /*#__PURE__*/ createReadContract({
  abi: mockErc20Abi,
  functionName: 'name',
})

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link mockErc20Abi}__ and `functionName` set to `"symbol"`
 */
export const readMockErc20Symbol = /*#__PURE__*/ createReadContract({
  abi: mockErc20Abi,
  functionName: 'symbol',
})

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link mockErc20Abi}__ and `functionName` set to `"totalSupply"`
 */
export const readMockErc20TotalSupply = /*#__PURE__*/ createReadContract({
  abi: mockErc20Abi,
  functionName: 'totalSupply',
})

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link mockErc20Abi}__
 */
export const writeMockErc20 = /*#__PURE__*/ createWriteContract({
  abi: mockErc20Abi,
})

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link mockErc20Abi}__ and `functionName` set to `"approve"`
 */
export const writeMockErc20Approve = /*#__PURE__*/ createWriteContract({
  abi: mockErc20Abi,
  functionName: 'approve',
})

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link mockErc20Abi}__ and `functionName` set to `"mint"`
 */
export const writeMockErc20Mint = /*#__PURE__*/ createWriteContract({
  abi: mockErc20Abi,
  functionName: 'mint',
})

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link mockErc20Abi}__ and `functionName` set to `"transfer"`
 */
export const writeMockErc20Transfer = /*#__PURE__*/ createWriteContract({
  abi: mockErc20Abi,
  functionName: 'transfer',
})

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link mockErc20Abi}__ and `functionName` set to `"transferFrom"`
 */
export const writeMockErc20TransferFrom = /*#__PURE__*/ createWriteContract({
  abi: mockErc20Abi,
  functionName: 'transferFrom',
})

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link mockErc20Abi}__
 */
export const simulateMockErc20 = /*#__PURE__*/ createSimulateContract({
  abi: mockErc20Abi,
})

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link mockErc20Abi}__ and `functionName` set to `"approve"`
 */
export const simulateMockErc20Approve = /*#__PURE__*/ createSimulateContract({
  abi: mockErc20Abi,
  functionName: 'approve',
})

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link mockErc20Abi}__ and `functionName` set to `"mint"`
 */
export const simulateMockErc20Mint = /*#__PURE__*/ createSimulateContract({
  abi: mockErc20Abi,
  functionName: 'mint',
})

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link mockErc20Abi}__ and `functionName` set to `"transfer"`
 */
export const simulateMockErc20Transfer = /*#__PURE__*/ createSimulateContract({
  abi: mockErc20Abi,
  functionName: 'transfer',
})

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link mockErc20Abi}__ and `functionName` set to `"transferFrom"`
 */
export const simulateMockErc20TransferFrom =
  /*#__PURE__*/ createSimulateContract({
    abi: mockErc20Abi,
    functionName: 'transferFrom',
  })

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link mockErc20Abi}__
 */
export const watchMockErc20Event = /*#__PURE__*/ createWatchContractEvent({
  abi: mockErc20Abi,
})

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link mockErc20Abi}__ and `eventName` set to `"Approval"`
 */
export const watchMockErc20ApprovalEvent =
  /*#__PURE__*/ createWatchContractEvent({
    abi: mockErc20Abi,
    eventName: 'Approval',
  })

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link mockErc20Abi}__ and `eventName` set to `"Transfer"`
 */
export const watchMockErc20TransferEvent =
  /*#__PURE__*/ createWatchContractEvent({
    abi: mockErc20Abi,
    eventName: 'Transfer',
  })

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link ownableAbi}__
 */
export const readOwnable = /*#__PURE__*/ createReadContract({ abi: ownableAbi })

/**
 * Wraps __{@link readContract}__ with `abi` set to __{@link ownableAbi}__ and `functionName` set to `"owner"`
 */
export const readOwnableOwner = /*#__PURE__*/ createReadContract({
  abi: ownableAbi,
  functionName: 'owner',
})

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link ownableAbi}__
 */
export const writeOwnable = /*#__PURE__*/ createWriteContract({
  abi: ownableAbi,
})

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link ownableAbi}__ and `functionName` set to `"renounceOwnership"`
 */
export const writeOwnableRenounceOwnership = /*#__PURE__*/ createWriteContract({
  abi: ownableAbi,
  functionName: 'renounceOwnership',
})

/**
 * Wraps __{@link writeContract}__ with `abi` set to __{@link ownableAbi}__ and `functionName` set to `"transferOwnership"`
 */
export const writeOwnableTransferOwnership = /*#__PURE__*/ createWriteContract({
  abi: ownableAbi,
  functionName: 'transferOwnership',
})

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link ownableAbi}__
 */
export const simulateOwnable = /*#__PURE__*/ createSimulateContract({
  abi: ownableAbi,
})

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link ownableAbi}__ and `functionName` set to `"renounceOwnership"`
 */
export const simulateOwnableRenounceOwnership =
  /*#__PURE__*/ createSimulateContract({
    abi: ownableAbi,
    functionName: 'renounceOwnership',
  })

/**
 * Wraps __{@link simulateContract}__ with `abi` set to __{@link ownableAbi}__ and `functionName` set to `"transferOwnership"`
 */
export const simulateOwnableTransferOwnership =
  /*#__PURE__*/ createSimulateContract({
    abi: ownableAbi,
    functionName: 'transferOwnership',
  })

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link ownableAbi}__
 */
export const watchOwnableEvent = /*#__PURE__*/ createWatchContractEvent({
  abi: ownableAbi,
})

/**
 * Wraps __{@link watchContractEvent}__ with `abi` set to __{@link ownableAbi}__ and `eventName` set to `"OwnershipTransferred"`
 */
export const watchOwnableOwnershipTransferredEvent =
  /*#__PURE__*/ createWatchContractEvent({
    abi: ownableAbi,
    eventName: 'OwnershipTransferred',
  })
