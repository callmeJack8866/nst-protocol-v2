/**
 * Contract Addresses & Network Configuration
 *
 * Network is controlled by VITE_TARGET_CHAIN_ID env variable:
 *   97  = BSC Testnet (default for dev)
 *   56  = BSC Mainnet (set in .env.production)
 */

/** Target chain driven by env var, defaults to 97 (Testnet) */
export const TARGET_CHAIN_ID = Number(import.meta.env.VITE_TARGET_CHAIN_ID || 97);

/** Set of chain IDs that this app supports */
export const SUPPORTED_CHAIN_IDS = new Set([56, 97]);

// ─── Contract Addresses ─────────────────────────────────────────────

// BSC Testnet (ChainID: 97) — 2026-03-11 latest deployment
export const BSC_TESTNET_ADDRESSES = {
    USDT: '0x6ae0833E637D1d99F3FCB6204860386f6a6713C0',
    Config: '0x9f839C36146c0c8867c2E36E33EA5A024be38e31',
    VaultManager: '0x9214D7f7b532E0fa1e6aFF7a0a6d3b6CE0754454',
    OptionsCore: '0x78F4600D6963044cCE956DC2322A92cB58142129',
    OptionsSettlement: '0x9B987C29b377F5112Aa5C51773ec9e79374C37bc',
    FeedProtocol: '0x3ADc2a24943d3B9ADd5570A7ad2035Ef547c6E45',
    SeatManager: '0xB364f37b3fD3e1f373907478e532449b4bA09343',
    PointsManager: '0x22074e05314c3A20cdD40C8D127E8306dc919dEC',
    VolumeBasedFeed: '0xa4d3d2D56902f91e92caDE54993f45b4376979C7',
    FeederSelector: '',
};

// BSC Mainnet (ChainID: 56) — placeholder, fill when deployed
export const BSC_MAINNET_ADDRESSES = {
    USDT: '0x55d398326f99059fF775485246999027B3197955',
    Config: '',
    VaultManager: '',
    OptionsCore: '',
    OptionsSettlement: '',
    FeedProtocol: '',
    SeatManager: '',
    PointsManager: '',
    VolumeBasedFeed: '',
    FeederSelector: '',
};

// ─── Chain Config ────────────────────────────────────────────────────

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

// Contract Display Names
export const CONTRACT_NAMES: Record<string, string> = {
    Config: 'System Config',
    VaultManager: 'Vault Manager',
    OptionsCore: 'Options Core',
    FeedProtocol: 'Feed Protocol',
    SeatManager: 'Seat Manager',
    PointsManager: 'Points Manager',
    VolumeBasedFeed: 'Volume Based Feed',
};

/** Get contract addresses by chainId */
export const getContractAddresses = (chainId: number) => {
    if (chainId === 56) return BSC_MAINNET_ADDRESSES;
    if (chainId === 97) return BSC_TESTNET_ADDRESSES;
    // Unsupported chain — return target chain addresses as fallback
    return TARGET_CHAIN_ID === 56 ? BSC_MAINNET_ADDRESSES : BSC_TESTNET_ADDRESSES;
};

/** Get chain config by chainId */
export const getChainConfig = (chainId: number) => {
    if (chainId === 56) return CHAINS.BSC_MAINNET;
    if (chainId === 97) return CHAINS.BSC_TESTNET;
    return TARGET_CHAIN_ID === 56 ? CHAINS.BSC_MAINNET : CHAINS.BSC_TESTNET;
};

/** Get the target chain config (the chain this app wants to be on) */
export const getTargetChainConfig = () => getChainConfig(TARGET_CHAIN_ID);
