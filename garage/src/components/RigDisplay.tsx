import React from "react";
import { Box, Image } from "@chakra-ui/react";
import { TrainerPilot } from "./TrainerPilot";
import { useRigImageUrls } from "../hooks/useRigImageUrls";
import { Rig } from "../types";

type BorderWidth = React.ComponentProps<typeof Box>["borderWidth"];

type Props = React.ComponentProps<typeof Box> & {
  rig: Rig;
  pilotNFT?: { imageUrl: string };
  pilotBorderWidth?: BorderWidth;
};

export const RigDisplay = ({
  rig,
  pilotNFT,
  pilotBorderWidth,
  ...props
}: Props) => {
  const { thumb } = useRigImageUrls(rig);

  const showPilot = rig.currentPilot;
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
    <Box position="relative" {...props}>
      <Image src={thumb} />
      <Box position="absolute" right="0" bottom="0" width="25%">
        {showPilot ? (
          imageUrl ? (
            <Image src={pilotNFT.imageUrl} {...pilotProps} />
          ) : (
            <TrainerPilot {...pilotProps} />
          )
        ) : null}
      </Box>
    </Box>
  );
};
