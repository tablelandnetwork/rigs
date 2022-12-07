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

  const showPilot = pilotNFT || rig.currentPilot || loading;
  const imageUrl = pilotNFT?.imageUrl;
  const svgData = pilotNFT?.imageSvgData;

  const borderWidth = pilotBorderWidth ?? "1px";

  const pilotProps = {
    borderTopLeftRadius: "3px",
    flexGrow: "1",
  };

  return (
    <Box position="relative" overflow="hidden" {...props}>
      <Image src={thumb} minWidth="100%" />
      {showPilot && (
        <Flex
          position="absolute"
          bgColor="paper"
          right="0"
          bottom="0"
          height="25%"
          width="25%"
          borderStyle="solid"
          borderTopWidth={borderWidth}
          borderLeftWidth={borderWidth}
          borderColor={"paper"}
          {...pilotProps}
        >
          {loading ? (
            <LoadingPilot {...pilotProps} />
          ) : imageUrl || svgData ? (
            <Image
              src={imageUrl || svgData}
              {...pilotProps}
              objectFit="contain"
            />
          ) : (
            <TrainerPilot {...pilotProps} />
          )}
        </Flex>
      )}
    </Box>
  );
};
