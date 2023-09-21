import { useContractReads } from "wagmi";
import { as0xString } from "../utils/types";
import { secondaryChain, deployment } from "../env";
import { abi as missionsAbi } from "../abis/MissionsManager";
import { abi as votingAbi } from "../abis/VotingRegistry";
import { useAccount } from "./useAccount";

const { votingContractAddress, missionContractAddress } = deployment;

const ZERO_ADDR = "0x0000000000000000000000000000000000000000" as const;

const MISSIONS_ADMIN_ROLE =
  "0x6de1decd3455ea3e945a8b81428c6da1e39da9f747dff73b900c35f95d8d9528" as const;
const VOTING_ADMIN_ROLE =
  "0x26e5e0c1d827967646b29471a0f5eef941c85bdbb97c194dc3fa6291a994a148" as const;

export const useIsAdmin = () => {
  const { address } = useAccount();

  const { isLoading, data } = useContractReads({
    allowFailure: false,
    enabled: !!address,
    contracts: [
      {
        chainId: secondaryChain.id,
        address: as0xString(votingContractAddress)!,
        abi: votingAbi,
        functionName: "hasRole",
        args: [VOTING_ADMIN_ROLE, address ?? ZERO_ADDR],
      },
      {
        chainId: secondaryChain.id,
        address: as0xString(missionContractAddress)!,
        abi: missionsAbi,
        functionName: "hasRole",
        args: [MISSIONS_ADMIN_ROLE, address ?? ZERO_ADDR],
      },
    ],
  });

  if (!data || isLoading) return { isLoading, data: null };

  return { isLoading, data: { votingAdmin: data[0], missionsAdin: data[1] } };
};
