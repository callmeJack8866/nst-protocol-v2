/**
 * Contract Addresses Configuration
 * Updated: 2026-01-28 17:15 BSC Testnet Deployment
 * Upgrade: Added exerciseDelay & feedRule support to createSellerOrder
 */

// BSC Testnet (ChainID: 97) - 2026-02-02 使用 18 位 Mock USDT
export const BSC_TESTNET_ADDRESSES = {
    USDT: '0x6ae0833E637D1d99F3FCB6204860386f6a6713C0',
    Config: '0x63aE7d11Ed0d939DEe6FC67e8bE89De79610c4Ea',
    VaultManager: '0xa81cCaE9b7aBfb2a24982A8FcA1A8Dd54dD49E54',
    OptionsCore: '0xC03f94273008525950c51052F6AB026823Cb4015',
    FeedProtocol: '0xb618341Ce5a762891f0Ffddee7cFc2a4b29D7F36',
    SeatManager: '0xB364f37b3fD3e1f373907478e532449b4bA09343',
    PointsManager: '0x22074e05314c3A20cdD40C8D127E8306dc919dEC',
    VolumeBasedFeed: '0xb618341Ce5a762891f0Ffddee7cFc2a4b29D7F36',
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
