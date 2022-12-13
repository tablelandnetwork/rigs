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
        <ModalHeader>About Pilots</ModalHeader>
        <ModalCloseButton />
        <ModalBody p={6}>
          <VStack>
            <Image src={garage} />
            <Heading as="h4" py={6}>
              Training Rigs
            </Heading>
            <Text pb={4}>
              Before your Rig can handle a real pilot (an ERC721 token that you
              own), it needs to accumulate enough FT with the trainer.
              <Text as="em" color="primaryLight">
                {" "}
                This will take about 30 days.
              </Text>
            </Text>
            <UnorderedList px={8}>
              <ListItem pb={2}>
                <Text as="em" color="primaryLight">
                  In-flight Rigs ARE NOT sellable or transferable!
                </Text>{" "}
                Your Rig may be auto-parked if it's listed on a marketplace.
              </ListItem>
              <ListItem>
                If your Rig has a real pilot that you sold or transferred, your
                Rig will be auto-parked if the new owner uses it as a pilot of a
                different Rig.
              </ListItem>
            </UnorderedList>
          </VStack>
        </ModalBody>
        <ModalFooter>
          <Button onClick={onClose}>Close</Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};
