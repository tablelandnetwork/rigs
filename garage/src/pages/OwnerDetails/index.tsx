import React, { useMemo } from "react";
import { Flex, Heading, Text, VStack } from "@chakra-ui/react";
import { useParams } from "react-router-dom";
import { useEnsName } from "wagmi";
import { useOwnedRigs } from "../../hooks/useOwnedRigs";
import { useOwnerPilots } from "../../hooks/useOwnerPilots";
import { useOwnerActivity } from "../../hooks/useOwnerActivity";
import { useOwnerFTRewards } from "../../hooks/useOwnerFTRewards";
import { useNFTsCached } from "../../components/NFTsContext";
import { TOPBAR_HEIGHT } from "../../Topbar";
import { RigsGrid } from "./modules/RigsInventory";
import { ActivityLog } from "./modules/Activity";
import { Pilots } from "./modules/Pilots";
import { FTRewards } from "./modules/FTRewards";
import { prettyNumber } from "../../utils/fmt";
import { isValidAddress } from "../../utils/types";

const GRID_GAP = 4;

const MODULE_PROPS = {
  borderRadius: "3px",
  p: 8,
  bgColor: "paper",
  overflow: "hidden",
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
  const { rigs } = useOwnedRigs(owner);
  const { pilots } = useOwnerPilots(owner);
  const { events } = useOwnerActivity(owner);
  const { nfts } = useNFTsCached(pilots);
  const { rewards } = useOwnerFTRewards(owner);

  const { data: ens } = useEnsName({
    address: isValidAddress(owner) ? owner : undefined,
  });

  const totalFt = useMemo(() => {
    if (!pilots) return;

    return pilots.map((p) => p.flightTime).reduce((a, b) => a + b, 0);
  }, [pilots]);

  return isValidAddress(owner) ? (
    <CenterContainer>
      <Flex
        direction="column"
        p={GRID_GAP}
        pt={{ base: GRID_GAP, md: GRID_GAP * 2 }}
        gap={GRID_GAP}
        align={{ base: "stretch", lg: "start" }}
        maxWidth="1385px"
        width="100%"
        minHeight={`calc(100vh - ${TOPBAR_HEIGHT})`}
      >
        <VStack {...MODULE_PROPS} width="100%" align="left">
          <Heading size="sm">Collector profile</Heading>
          <Heading pb={8}>{ens ?? owner}</Heading>

          {totalFt && (
            <Heading size="sm">
              Total FT earned:{" "}
              <Text as="span" fontWeight="bold">
                {prettyNumber(totalFt)}
              </Text>
            </Heading>
          )}
        </VStack>
        <Flex
          direction={{ base: "column", lg: "row" }}
          gap={GRID_GAP}
          width="100%"
          align={{ base: "stretch", lg: "start" }}
        >
          <VStack align="top" spacing={GRID_GAP}>
            <RigsGrid
              rigs={rigs}
              nfts={nfts}
              {...MODULE_PROPS}
              gap={GRID_GAP}
              flexGrow="1"
            />
            <FTRewards rewards={rewards} {...MODULE_PROPS} flexGrow="1" />
          </VStack>
          <VStack flexShrink="0" align="top" spacing={GRID_GAP}>
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
