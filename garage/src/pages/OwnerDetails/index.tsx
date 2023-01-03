import React from "react";
import { Flex, Heading, VStack } from "@chakra-ui/react";
import { useParams } from "react-router-dom";
import { useBlockNumber } from "wagmi";
import { useOwnedRigs } from "../../hooks/useOwnedRigs";
import { useOwnerPilots } from "../../hooks/useOwnerPilots";
import { useOwnerActivity } from "../../hooks/useOwnerActivity";
import { useNFTs } from "../../hooks/useNFTs";
import { TOPBAR_HEIGHT } from "../../Topbar";
import { RigsGrid } from "./modules/RigsInventory";
import { ActivityLog } from "./modules/Activity";
import { Pilots } from "./modules/Pilots";

const GRID_GAP = 4;

const MODULE_PROPS = {
  borderRadius: "3px",
  p: 8,
  bgColor: "paper",
  overflow: "hidden",
};

const isValidAddress = (address?: string): boolean => {
  return /0x[0-9a-z]{40,40}/i.test(address || "");
};

const CenterContainer = ({ children }: React.PropsWithChildren) => {
  return (
    <Flex
      direction="column"
      align="center"
      width="100%"
      minHeight={`calc(100vh - ${TOPBAR_HEIGHT} + 40px)`}
      mb="40px"
    >
      {children}
    </Flex>
  );
};

export const OwnerDetails = () => {
  const { owner } = useParams();
  const { data: currentBlockNumber } = useBlockNumber();
  const { rigs } = useOwnedRigs(owner, currentBlockNumber);
  const { pilots } = useOwnerPilots(owner, currentBlockNumber);
  const { events } = useOwnerActivity(owner);
  const { nfts } = useNFTs(pilots);

  return isValidAddress(owner) ? (
    <CenterContainer>
      <Flex
        direction="column"
        p={GRID_GAP}
        gap={GRID_GAP}
        align={{ base: "stretch", lg: "start" }}
        maxWidth="1385px"
        width="100%"
        minHeight={`calc(100vh - ${TOPBAR_HEIGHT})`}
      >
        <VStack {...MODULE_PROPS} width="100%" align="left">
          <Heading size="sm">Collector profile</Heading>
          <Heading>{owner}</Heading>
        </VStack>
        <Flex
          direction={{ base: "column", lg: "row" }}
          gap={GRID_GAP}
          width="100%"
          align={{ base: "stretch", lg: "start" }}
        >
          <RigsGrid
            rigs={rigs}
            nfts={nfts}
            {...MODULE_PROPS}
            gap={GRID_GAP}
            flexGrow="1"
          />
          <VStack flexShrink="0" align="top">
            <Pilots pilots={pilots} nfts={nfts} {...MODULE_PROPS} />
            <ActivityLog events={events} {...MODULE_PROPS} />
          </VStack>
        </Flex>
      </Flex>
    </CenterContainer>
  ) : (
    <CenterContainer>
      <Heading p={20}>Invalid address</Heading>
    </CenterContainer>
  );
};
