import { ethers } from "hardhat";

async function main() {
    const [deployer] = await ethers.getSigners();
    const FP = "0x3ADc2a24943d3B9ADd5570A7ad2035Ef547c6E45";
    const CORE = "0x78F4600D6963044cCE956DC2322A92cB58142129";
    
    const fp = new ethers.Contract(FP, [
        "function setOptionsCore(address) external",
        "function optionsCore() view returns (address)"
    ], deployer);
    
    console.log("Before:", await fp.optionsCore());
    const tx = await fp.setOptionsCore(CORE);
    await tx.wait();
    console.log("After:", await fp.optionsCore());
    console.log("✅ Done!");
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
