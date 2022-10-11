import { ChainName } from "@tableland/sdk";
export interface RigsDeployment {
    contractAddress: string;
    royaltyContractAddress: string;
    tablelandChain: ChainName;
    tablelandHost: "https://testnet.tableland.network" | "https://staging.tableland.network" | "http://localhost:8080";
    contractTable: string;
    allowlistTable: string;
    partsTable: string;
    layersTable: string;
    attributesTable: string;
    lookupsTable: string;
    pilotSessionsTable: string;
    displayAttributes: boolean;
}
export interface RigsDeployments {
    [key: string]: RigsDeployment;
}
export declare const deployments: RigsDeployments;
//# sourceMappingURL=deployments.d.ts.map