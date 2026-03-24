import { ethers } from "hardhat";

async function main() {
    const [deployer] = await ethers.getSigners();
    const NEW_OS = "0x9B987C29b377F5112Aa5C51773ec9e79374C37bc";
    const VM = "0x9214D7f7b532E0fa1e6aFF7a0a6d3b6CE0754454";
    
    const roleABI = [
        "function grantRole(bytes32,address) external",
        "function hasRole(bytes32,address) view returns (bool)",
    ];
    const vm = new ethers.Contract(VM, roleABI, deployer);

    // Try all possible roles
    const roleNames = [
        "OPERATOR_ROLE", "SETTLEMENT_ROLE", "PROTOCOL_ROLE", 
        "MINTER_ROLE", "DEFAULT_ADMIN_ROLE"
    ];

    for (const name of roleNames) {
        const role = name === "DEFAULT_ADMIN_ROLE" 
            ? ethers.ZeroHash 
            : ethers.keccak256(ethers.toUtf8Bytes(name));
        try {
            const has = await vm.hasRole(role, NEW_OS);
            console.log(`VM.hasRole(${name}, OS): ${has}`);
            if (!has) {
                await (await vm.grantRole(role, NEW_OS)).wait();
                console.log(`  ✅ Granted ${name}`);
            }
        } catch (e: any) {
            console.log(`  ⚠️ ${name} failed:`, (e as any).reason?.slice(0, 50) || "unknown");
        }
    }
    
    console.log("\n✅ Done!");
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
