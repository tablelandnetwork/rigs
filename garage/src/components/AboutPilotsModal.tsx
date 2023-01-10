import React from "react";
import {
  Button,
  Heading,
  UnorderedList,
  ListItem,
  Image,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  ModalOverlay,
  ModalCloseButton,
  Text,
  VStack,
} from "@chakra-ui/react";
import garage from "../assets/garage.jpg";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AboutPilotsModal = ({ isOpen, onClose }: ModalProps) => {
  return (
    <Modal isOpen={isOpen} onClose={onClose} size="xl">
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>About piloting and FT</ModalHeader>
        <ModalCloseButton />
        <ModalBody px={6} pb={6}>
          <VStack align="start">
            <Image src={garage} />
            <Heading as="h4" pt={6}>
              Flight Time (FT)
            </Heading>
            <Text pb={3}>
              Flight Time is a non-transferrable reputation metric for
              the Tableland ecosystem (that is stored and tracked in Tableland!).
            </Text>
            <Text>
              As a Rig owner you can earn FT by taking your Rigs flying.
              A Rig that is in-flight cannot be transferred or sold,
              and as a reward for taking your Rig off the market you earn FT (also referred to as soft-staking, the NFT doesn't leave your wallet but it is locked).
            </Text>
            <Heading as="h4" pt={6}>
              Pilots and training
            </Heading>
            <Text pb={3}>
              Every Rig must go through a training phase with a trainer pilot to re-learn how to fly.
              Training takes <Text as="em" color="primaryLight">172,800 blocks </Text>
              (about 30 days).
            </Text>
            <Text>
              After training you can use any ERC721 token that you
              own to pilot your Rigs. Pilot history is stored on Tableland,
              and can be queried and reflected in metadata.
            </Text>
            <Heading as="h4" pt={6}>
              How do I train/pilot my Rigs?
            </Heading>
            <Text>
              Training, piloting and parking all require an on-chain transaction.
              This means that you will have to sign a transaction and pay a small gas every time you fee for every action you take.
            </Text>
          </VStack>
        </ModalBody>
        <ModalFooter>
          <Button onClick={onClose}>Close</Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};
