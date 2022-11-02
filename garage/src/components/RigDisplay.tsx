import React from "react";
import { Box, Flex, Image, Spinner } from "@chakra-ui/react";
import { TrainerPilot } from "./TrainerPilot";
import { useRigImageUrls } from "../hooks/useRigImageUrls";
import { Rig } from "../types";
import { NFT } from "../hooks/useNFTs";

type BorderWidth = React.ComponentProps<typeof Box>["borderWidth"];

type Props = React.ComponentProps<typeof Box> & {
  rig: Rig;
  pilotNFT?: NFT;
  loading?: boolean;
  pilotBorderWidth?: BorderWidth;
};

const LoadingPilot = (props: React.ComponentProps<typeof Box>) => {
  return (
    <Flex
      justify="center"
      align="center"
      backgroundColor="primary"
      {...props}
      sx={{ aspectRatio: "1/1" }}
    >
      <Spinner size="lg" color="black" />
    </Flex>
  );
};

export const RigDisplay = ({
  rig,
  pilotNFT,
  pilotBorderWidth,
  loading = false,
  ...props
}: Props) => {
  const { thumb } = useRigImageUrls(rig);

  const showPilot = rig.currentPilot || loading;
  const imageUrl = pilotNFT?.imageUrl;

  const borderWidth = pilotBorderWidth ?? "1px";

  const pilotProps = {
    borderStyle: "solid",
    borderTopWidth: borderWidth,
    borderLeftWidth: borderWidth,
    borderColor: "paper",
    borderTopLeftRadius: "3px",
  };

  return (
    <Box position="relative" overflow="hidden" {...props}>
      <Image src={thumb} minWidth="100%" />
      <Box position="absolute" right="0" bottom="0" width="25%">
        {showPilot ? (
          loading ? (
            <LoadingPilot {...pilotProps} />
          ) : imageUrl ? (
            <Image src={pilotNFT.imageUrl} {...pilotProps} bgColor="paper" />
          ) : (
            <TrainerPilot {...pilotProps} />
          )
        ) : null}
      </Box>
    </Box>
  );
};
