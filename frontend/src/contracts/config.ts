/**
 * Contract Addresses Configuration
 * Updated: 2025-12-30 BSC Testnet Deployment
 */

// BSC Testnet (ChainID: 97)
export const BSC_TESTNET_ADDRESSES = {
    USDT: '0x337610d27c682E347C9cD60BD4b3b107C9d34dDd',
    Config: '0x9376e87c6e144a906eC93042D2Fd47D19eF6f376',
    VaultManager: '0x600AFcF2eD6a404C0A675E4B386b88AeE6E77324',
    OptionsCore: '0x8A791620dd6260079BF849Dc5567aDC3F2FdC318',
    FeedProtocol: '0x0165878A594ca255338adfa4d48449f69242Eb8F',
    SeatManager: '0xa513E6E4b8f2a923D98304ec87F64353C4D5C853',
    PointsManager: '0x2279B7A0a67DB372996a5FaB50D91eAA73d2eBe6',
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
