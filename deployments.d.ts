export interface RigsDeployment {
    contractAddress: string;
    royaltyContractAddress: string;
    contractTable: string;
    allowlistTable: string;
}
export interface RigsDeployments {
    [key: string]: RigsDeployment;
}
export declare const deployments: RigsDeployments;
//# sourceMappingURL=deployments.d.ts.map