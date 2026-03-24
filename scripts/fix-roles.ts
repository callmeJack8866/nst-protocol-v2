import { ethers } from "hardhat";

/**
 * 给新 FeedProtocol 在 OptionsCore 上授予必要的角色
 */
async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Deployer:", deployer.address);

    const NEW_FP = "0x3ADc2a24943d3B9ADd5570A7ad2035Ef547c6E45";
    const OC = "0x78F4600D6963044cCE956DC2322A92cB58142129";
    const OS = "0x8DF881593368FD8be3F40722fcb9f555593a8257";

    const roleABI = [
        "function grantRole(bytes32 role, address account) external",
        "function hasRole(bytes32 role, address account) view returns (bool)",
        "function DEFAULT_ADMIN_ROLE() view returns (bytes32)",
    ];

    // Calculate possible role hashes
    const roles = [
        { name: "PROTOCOL_ROLE", hash: ethers.keccak256(ethers.toUtf8Bytes("PROTOCOL_ROLE")) },
        { name: "FEED_PROTOCOL_ROLE", hash: ethers.keccak256(ethers.toUtf8Bytes("FEED_PROTOCOL_ROLE")) },
        { name: "FEED_ROLE", hash: ethers.keccak256(ethers.toUtf8Bytes("FEED_ROLE")) },
        { name: "FEEDER_ROLE", hash: ethers.keccak256(ethers.toUtf8Bytes("FEEDER_ROLE")) },
    ];

    // The role from the error: 0x04967fd...
    const errorRole = "0x04967fd25e7aa667b18955d808f19fd0c86238999ff8be2ebc72cd2cd3a83d";
    console.log("\nError role hash:", errorRole);
    
    for (const r of roles) {
        console.log(`${r.name}: ${r.hash}`);
        if (r.hash.startsWith(errorRole.slice(0, 10))) {
            console.log("  ^^^ MATCH!");
        }
    }

    // Grant all relevant roles on OptionsCore
    const oc = new ethers.Contract(OC, roleABI, deployer);
    
    for (const r of roles) {
        try {
            const has = await oc.hasRole(r.hash, NEW_FP);
            console.log(`\nOptionsCore.hasRole(${r.name}, newFP): ${has}`);
            if (!has) {
                console.log(`  Granting ${r.name}...`);
                const tx = await oc.grantRole(r.hash, NEW_FP);
                await tx.wait();
                console.log(`  ✅ Granted`);
            }
        } catch (e) {
            console.log(`  ⚠️ ${r.name} grant failed:`, (e as any).reason || (e as any).message?.slice(0, 100));
        }
    }

    // Also grant on OptionsSettlement
    const os = new ethers.Contract(OS, roleABI, deployer);
    for (const r of roles) {
        try {
            const has = await os.hasRole(r.hash, NEW_FP);
            console.log(`\nOptionsSettlement.hasRole(${r.name}, newFP): ${has}`);
            if (!has) {
                console.log(`  Granting ${r.name}...`);
                const tx = await os.grantRole(r.hash, NEW_FP);
                await tx.wait();
                console.log(`  ✅ Granted`);
            }
        } catch (e) {
            console.log(`  ⚠️ ${r.name} grant failed:`, (e as any).reason || (e as any).message?.slice(0, 100));
        }
    }

    console.log("\n✅ All roles granted!");
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
