import React, { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Button,
  Flex,
  HStack,
  Image,
  Input,
  InputGroup,
  InputLeftElement,
  InputRightElement,
  Kbd,
  Modal,
  ModalOverlay,
  ModalContent,
  Show,
  Spacer,
  Text,
  useDisclosure,
} from "@chakra-ui/react";
import { SearchIcon } from "@chakra-ui/icons";
import { TablelandConnectButton } from "./components/TablelandConnectButton";
import logo from "./assets/tableland.svg";
import { useCurrentRoute } from "./hooks/useCurrentRoute";
import { useKeysDown } from "./hooks/useKeysDown";

export const TOPBAR_HEIGHT = "80px";

const useFocus = () => {
  const [focused, setFocused] = useState(false);
  const onFocus = useCallback(() => setFocused(true), [setFocused]);
  const onBlur = useCallback(() => setFocused(false), [setFocused]);

  return { focused, onFocus, onBlur };
};

const RigSearchForm = ({ onSubmit }: { onSubmit?: () => void }) => {
  const navigate = useNavigate();
  const keysDown = useKeysDown();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (
      (keysDown.has("Meta") || keysDown.has("Control")) &&
      keysDown.has("k")
    ) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [keysDown]);

  const [searchValue, setSearchValue] = useState("");
  const onInputChanged = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setSearchValue(e.target.value);
    },
    [setSearchValue]
  );

  const onInputKeypressed = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        const rigId = parseInt(searchValue, 10);
        if (rigId > 0 && rigId < 3001) {
          navigate(`/rigs/${rigId}`);
          setSearchValue("");
          inputRef.current?.blur();
          window.scrollTo(0, 0);
          onSubmit?.();
        }
      }
    },
    [navigate, searchValue, setSearchValue]
  );

  const { focused, onFocus, onBlur } = useFocus();

  return (
    <InputGroup
      maxWidth={{ base: "auto", md: "300px" }}
      minWidth="120px"
      flexGrow="1"
    >
      <InputLeftElement
        pointerEvents="none"
        children={<SearchIcon color="#FFFFFFAA" />}
      />
      <Input
        type="number"
        placeholder="Rig #"
        color="#FFFFFFAA"
        bgColor="#00000033"
        borderColor="#00000033"
        focusBorderColor="#00000022"
        ref={inputRef}
        value={searchValue}
        onChange={onInputChanged}
        onKeyPress={onInputKeypressed}
        onFocus={onFocus}
        onBlur={onBlur}
        min="0"
        max="3000"
        pr={{ base: "12px", sm: "48px" }}
        size="md"
      />
      <Show above="sm">
        <InputRightElement
          pointerEvents="none"
          width="48px"
          children={
            <HStack color="#FFFFFFAA" mr={3}>
              {focused ? (
                <Kbd>Enter</Kbd>
              ) : (
                <>
                  <Kbd>⌘</Kbd>
                  <Kbd>K</Kbd>
                </>
              )}
            </HStack>
          }
        />
      </Show>
    </InputGroup>
  );
};

const SearchModal = ({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) => {
  return (
    <Modal size="sm" isOpen={isOpen} onClose={onClose}>
      <ModalOverlay />
      <ModalContent>
        <RigSearchForm onSubmit={onClose} />
      </ModalContent>
    </Modal>
  );
};

export const Topbar = () => {
  const route = useCurrentRoute();

  const isEnter = route?.route.key === "ENTER";
  const bgColor = isEnter ? "primaryLight" : "primary";

  const { isOpen, onClose, onOpen } = useDisclosure();

  return (
    <Flex
      height={TOPBAR_HEIGHT}
      width="100%"
      bg={bgColor}
      color="black"
      align="center"
      position="sticky"
      top="0"
      zIndex={2}
      px={8}
      py={4}
    >
      <SearchModal isOpen={isOpen} onClose={onClose} />
      <Link to="/dashboard">
        <Image
          src={logo}
          sx={{ maxWidth: { base: "50px", md: "100%" } }}
          mr={2}
        />
      </Link>
      <Show above="md">
        <Text variant="orbitron" fontSize="20">
          Garage
        </Text>
      </Show>
      <Flex justify="space-between" align="center" width="100%" ml={8}>
        {!isEnter ? (
          <Flex
            align="center"
            gap={4}
            mr={4}
            flexGrow="1"
            justify="space-between"
          >
            <Show above="sm">
              <Button
                variant="solid"
                as={Link}
                to="/dashboard"
                flexGrow="0"
                flexShrink="0"
              >
                Dashboard
              </Button>
            </Show>
            <Show below="md">
              <Button onClick={onOpen} variant="ghost" color="paper">
                <SearchIcon />
              </Button>
            </Show>
            <Show above="md">
              <RigSearchForm />
            </Show>
          </Flex>
        ) : (
          <Spacer />
        )}
        <TablelandConnectButton />
      </Flex>
    </Flex>
  );
};
