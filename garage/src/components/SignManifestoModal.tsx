import {
  Button,
  Flex,
  Heading,
  ListItem,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  OrderedList,
  Text,
} from "@chakra-ui/react";

interface SignManifestoModalProps {
  isOpen: boolean;
  onAgree: () => void;
}

export const SignManifestoModal = ({
  isOpen,
  onAgree,
}: SignManifestoModalProps) => {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onAgree}
      size="6xl"
      closeOnOverlayClick={false}
      closeOnEsc={false}
    >
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Mission Board Manifesto</ModalHeader>
        <ModalBody>
          <Flex direction="column" gap={8}>
            <Text>
              Welcome, Pioneer. You stand on the precipice of a new frontier,
              the virtual expanse of Tableland. This is not just a metaverse;
              it's a realm of boundless potential, a testament to the power of
              collective imagination, and a beacon of decentralized
              collaboration.
            </Text>
            <Text>
              By signing this manifesto, you're not merely gaining access to The
              Mission Board; you're integrating into a living, breathing
              ecosystem. As an agent and contributor, you're expanding the
              limitless horizons of Tableland.
            </Text>

            <Heading>Our Pledge</Heading>
            <OrderedList listStylePos="inside" spacing={4}>
              <ListItem>
                <span style={{ fontWeight: "bold" }}>We are Innovators:</span>{" "}
                We harness the potential of decentralized technology to
                accelerate the exchange of information across society,
                leveraging the capabilities of Tableland to craft, manage, and
                transform the virtual realm for the betterment of humankind.
              </ListItem>
              <ListItem>
                <span style={{ fontWeight: "bold" }}>We are Stewards:</span> We
                understand that the power to shape the future lies in our hands.
                We pledge to use this power responsibly, to construct a virtual
                space that reflects our shared values and ambitions. We are
                dedicated to cultivating a sustainable, inventive, and inspiring
                ecosystem within Tableland and beyond.
              </ListItem>
              <ListItem>
                <span style={{ fontWeight: "bold" }}>We are Community:</span> We
                are a collective of diverse and unique individuals, bound
                together by a common vision of a new Internet. We value each
                member of our community and nurture an environment of
                inclusivity, respect, and mutual support.
              </ListItem>
            </OrderedList>

            <Heading>Your Role</Heading>
            <Text>
              As a contributor to the Tableland Mission Board, you are a key
              player in this pioneering journey. You will have the opportunity
              to access exclusive opportunities, contribute to the development
              of the Tableland ecosystem, be rewarded for your efforts in Flight
              Time (FT) and other perks, as well as having a voice and the right
              to vote in community decisions.
            </Text>

            <Heading>Code of Conduct</Heading>
            <Text>By signing this manifesto, you agree to:</Text>

            <OrderedList listStylePos="inside" spacing={4}>
              <ListItem>
                <span style={{ fontWeight: "bold" }}>Respect Others:</span>{" "}
                Treat all members of the community with respect and kindness.
                Discrimination, harassment, or any form of disrespectful
                behavior will not be tolerated.
              </ListItem>
              <ListItem>
                <span style={{ fontWeight: "bold" }}>Collaborate Openly:</span>{" "}
                Share your knowledge, learn from others, and work together to
                achieve common goals. The strength of Tableland lies in the
                collective intelligence of its community.
              </ListItem>
              <ListItem>
                <span style={{ fontWeight: "bold" }}>Uphold Integrity:</span> Be
                honest, be transparent, and uphold the highest standards of
                integrity. Your actions reflect on the entire community.
              </ListItem>
            </OrderedList>
            <Text>
              By signing this manifesto, you are not just joining a mission
              board; you are becoming a part of Tableland's story. We look
              forward to your contributions as we shape the future of this
              virtual frontier together.
            </Text>
          </Flex>
        </ModalBody>
        <ModalFooter>
          <Button onClick={onAgree}>I AGREE</Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};
