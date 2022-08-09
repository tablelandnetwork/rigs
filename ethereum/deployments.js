"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deployments = void 0;
exports.deployments = {
    // mainnets
    ethereum: {
        contractAddress: "0x8EAa9AE1Ac89B1c8C8a8104D08C045f78Aadb42D",
        royaltyContractAddress: "0x9BE9627e25c9f348C1edB6E46dBCa2a6669e2D56",
        tablelandChain: "ethereum-goerli",
        tablelandHost: "https://testnet.tableland.network",
        contractTable: "rigs_contract_5_57",
        allowlistTable: "rigs_allowlist_5_59",
        partsTable: "parts_5_30",
        layersTable: "layers_5_29",
        tokensTable: "rigs_5_28",
        attributesTable: "rig_attributes_5_27",
    },
    // testnets
    "polygon-mumbai": {
        contractAddress: "0x875fc1205Cb81A1F38fC4deEC44390c2aC5f5890",
        royaltyContractAddress: "0x13287B498F61c735221e11eD2ED6808597d996f3",
        tablelandChain: "ethereum-goerli",
        tablelandHost: "https://testnet.tableland.network",
        contractTable: "rigs_contract_5_57",
        allowlistTable: "rigs_allowlist_5_59",
        partsTable: "parts_5_21",
        layersTable: "layers_5_19",
        tokensTable: "rigs_5_22",
        attributesTable: "rig_attributes_5_20",
    },
    localhost: {
        contractAddress: "",
        royaltyContractAddress: "",
        tablelandChain: "ethereum-goerli",
        tablelandHost: "http://localhost:8080",
        contractTable: "",
        allowlistTable: "",
        partsTable: "",
        layersTable: "",
        tokensTable: "",
        attributesTable: "",
    },
};
//# sourceMappingURL=deployments.js.map