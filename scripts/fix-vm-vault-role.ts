import { ethers } from "hardhat";

async function main() {
    const [deployer] = await ethers.getSigners();
    const NEW_OS = "0x9B987C29b377F5112Aa5C51773ec9e79374C37bc";
    const VM = "0x9214D7f7b532E0fa1e6aFF7a0a6d3b6CE0754454";
    
    const VAULT_OPERATOR_ROLE = ethers.keccak256(ethers.toUtf8Bytes("VAULT_OPERATOR_ROLE"));
    console.log("VAULT_OPERATOR_ROLE hash:", VAULT_OPERATOR_ROLE);

    const vm = new ethers.Contract(VM, [
        "function grantRole(bytes32,address) external",
        "function hasRole(bytes32,address) view returns (bool)",
    ], deployer);

    console.log("Before:", await vm.hasRole(VAULT_OPERATOR_ROLE, NEW_OS));
    const tx = await vm.grantRole(VAULT_OPERATOR_ROLE, NEW_OS);
    await tx.wait();
    console.log("After:", await vm.hasRole(VAULT_OPERATOR_ROLE, NEW_OS));
    console.log("✅ VAULT_OPERATOR_ROLE granted!");
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
