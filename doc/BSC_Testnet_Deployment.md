# NST Options MVP - BSC Testnet 部署记录

日期: 2025-12-30

## 部署网络
- **Network**: BSC Testnet (Chain ID: 97)
- **Deployer**: 0xeaDD55Cf2eCaA09f2667d5a53DD1e825F05777a0

## 合约地址

> [!NOTE]
> 以下地址为测试网部署地址，每次部署后需更新

| 合约 | 地址 |
|------|------|
| Config | 待确认 |
| VaultManager | 待确认 |
| FeedProtocol | 待确认 |
| SeatManager | 待确认 |
| PointsManager | 待确认 |
| OptionsCore | 待确认 |
| USDT (Testnet) | 0x337610d27c682E347C9cD60BD4b3b107C9d34dDd |

## 验证链接

合约可在 [BscScan Testnet](https://testnet.bscscan.com/) 上验证

## 前端配置

更新 `frontend/src/contracts/config.ts` 中的测试网合约地址

## 下次部署命令

```bash
npx hardhat run scripts/deploy.ts --network bscTestnet
```
