/**
 * Contract Addresses Configuration
 * Updated: 2026-01-25 BSC Testnet Deployment (with requestFeedPublic)
 */

// BSC Testnet (ChainID: 97)
export const BSC_TESTNET_ADDRESSES = {
    USDT: '0x9f2140319726F9b851073a303415f13EC0cdA269',
    Config: '0x5d660E670c943498176A50ebE8Ce11864962cA4c',
    VaultManager: '0x8bCA279AB4fbaabEf27E80623b5F4E922d259D9B',
    OptionsCore: '0x3eF66aFCe1DD7598460A0fE6AEeF18cbF3c92964',
    FeedProtocol: '0x73c55A0EE01B227FeB172d53CEDD90cF27A46D2A',
    SeatManager: '0x40713eAC4c3EFf23958e41EFfC65c5AC04ae677B',
    PointsManager: '0x2d8EbE09234dbBb89215cC6b9964D58cf1c16d14',
    VolumeBasedFeed: '',
    FeederSelector: '',
};

// BSC Mainnet (ChainID: 56) - Not deployed yet
export const BSC_MAINNET_ADDRESSES = {
    USDT: '0x55d398326f99059fF775485246999027B3197955',
    Config: '',
    VaultManager: '',
    OptionsCore: '',
    FeedProtocol: '',
    SeatManager: '',
    PointsManager: '',
    VolumeBasedFeed: '',
    FeederSelector: '',
};

// Contract Display Names
export const CONTRACT_NAMES: Record<string, string> = {
    Config: 'System Config',
    VaultManager: 'Vault Manager',
    OptionsCore: 'Options Core',
    FeedProtocol: 'Feed Protocol',
    SeatManager: 'Seat Manager',
    PointsManager: 'Points Manager',
};

// Chain configurations
export const CHAINS = {
    BSC_MAINNET: {
        chainId: 56,
        name: 'BSC Mainnet',
        rpcUrl: 'https://bsc-dataseed1.binance.org/',
        blockExplorer: 'https://bscscan.com',
        nativeCurrency: { name: 'BNB', symbol: 'BNB', decimals: 18 },
    },
    BSC_TESTNET: {
        chainId: 97,
        name: 'BSC Testnet',
        rpcUrl: 'https://data-seed-prebsc-1-s1.binance.org:8545/',
        blockExplorer: 'https://testnet.bscscan.com',
        nativeCurrency: { name: 'tBNB', symbol: 'tBNB', decimals: 18 },
    },
};

// Get contract addresses by chainId
export const getContractAddresses = (chainId: number) => {
    if (chainId === 56) return BSC_MAINNET_ADDRESSES;
    if (chainId === 97) return BSC_TESTNET_ADDRESSES;
    return BSC_TESTNET_ADDRESSES;
};

// Get chain config by chainId
export const getChainConfig = (chainId: number) => {
    if (chainId === 56) return CHAINS.BSC_MAINNET;
    if (chainId === 97) return CHAINS.BSC_TESTNET;
    return CHAINS.BSC_TESTNET;
};
