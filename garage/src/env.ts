import * as chains from "wagmi/chains";
import { deployments } from "@tableland/rigs/deployments";

// We are separating NODE_ENV (development or production) from our deployment environment
// because NODE_ENV changes npm behavior.
//
// NODE_ENV: should the app behave like in development or production
// APP_ENV: where is the app deployed
enum DeploymentEnvironment {
  DEVELOPMENT,
  STAGING,
  PRODUCTION,
}

const parseEnv = (env?: string): DeploymentEnvironment => {
  if (env === "development") return DeploymentEnvironment.DEVELOPMENT;
  if (env === "staging") return DeploymentEnvironment.STAGING;
  if (env === "production") return DeploymentEnvironment.PRODUCTION;

  console.warn("Could not parse environment, defaulting to DEVELOPMENT");

  return DeploymentEnvironment.DEVELOPMENT;
};

const environment = parseEnv(import.meta.env.VITE_APP_ENV);

const mainChainEnvMapping = {
  [DeploymentEnvironment.DEVELOPMENT]: chains.polygonMumbai,
  [DeploymentEnvironment.STAGING]: chains.polygonMumbai,
  [DeploymentEnvironment.PRODUCTION]: chains.mainnet,
};

const secondaryChainEnvMapping = {
  [DeploymentEnvironment.DEVELOPMENT]: chains.polygonMumbai,
  [DeploymentEnvironment.STAGING]: chains.polygonMumbai,
  [DeploymentEnvironment.PRODUCTION]: chains.arbitrum,
};

// Main chain used by the rigs contract
export const mainChain = mainChainEnvMapping[environment];

// Chain used by secondary tables, like ft rewards and the voting mechanism
export const secondaryChain = secondaryChainEnvMapping[environment];

const blockExplorerChainMapping = {
  [DeploymentEnvironment.DEVELOPMENT]:
    mainChainEnvMapping[DeploymentEnvironment.STAGING].blockExplorers.etherscan.url,
  [DeploymentEnvironment.STAGING]:
    mainChainEnvMapping[DeploymentEnvironment.STAGING].blockExplorers.etherscan.url,
  [DeploymentEnvironment.PRODUCTION]:
    mainChainEnvMapping[DeploymentEnvironment.PRODUCTION].blockExplorers.etherscan
      .url,
};

export const blockExplorerBaseUrl = blockExplorerChainMapping[environment];

export const openseaBaseUrl =
  environment === DeploymentEnvironment.PRODUCTION
    ? "https://opensea.io/assets/ethereum"
    : "https://testnets.opensea.io/assets/mumbai";

const deploymentEnvMapping = {
  [DeploymentEnvironment.DEVELOPMENT]: deployments["polygon-mumbai"],
  [DeploymentEnvironment.STAGING]: deployments["polygon-mumbai"],
  [DeploymentEnvironment.PRODUCTION]: deployments.ethereum,
};

export const deployment = deploymentEnvMapping[environment];
