import React, { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Box,
  Button,
  Divider,
  Drawer,
  DrawerBody,
  DrawerHeader,
  DrawerOverlay,
  DrawerContent,
  Flex,
  HStack,
  IconButton,
  Input,
  InputGroup,
  InputLeftElement,
  InputRightElement,
  Kbd,
  List,
  ListItem,
  Modal,
  ModalOverlay,
  ModalContent,
  Show,
  Spacer,
  Text,
  useDisclosure,
} from "@chakra-ui/react";
import { SearchIcon, HamburgerIcon } from "@chakra-ui/icons";
import {
  TablelandConnectButton,
  MobileNavTablelandConnectButton,
} from "./components/TablelandConnectButton";
import { ReactComponent as Logo } from "./assets/tableland.svg";
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

interface NavButtonProps extends React.ComponentProps<typeof Button> {
  active: boolean;
  route: string;
  title: string;
}

const inactiveProps = {
  variant: "ghost",
  color: "bg",
  _hover: { color: "primary", bgColor: "paper" },
};

const activeProps = {
  variant: "solid",
};

const NavButton = ({ active, route, title, ref, ...rest }: NavButtonProps) => {
  const props = active ? activeProps : inactiveProps;
  return (
    <Button
      {...props}
      {...rest}
      as={Link}
      to={route}
      flexGrow="0"
      flexShrink="0"
    >
      {title}
    </Button>
  );
};

const MobileDrawer = ({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) => {
  const route = useCurrentRoute();

  return (
    <Drawer isOpen={isOpen} placement="top" onClose={onClose}>
      <DrawerOverlay />
      <DrawerContent bgColor="primary">
        <DrawerHeader>
          <Flex>
            <Box sx={{ maxWidth: { base: "50px", md: "100%" } }} mr={3}>
              <Logo />
            </Box>
            <Text variant="orbitron" fontSize="20" color="paper">
              Garage
            </Text>
          </Flex>
        </DrawerHeader>

        <DrawerBody>
          <List color="paper">
            <Divider bgColor="inactive" />
            <ListItem textAlign="center" py={3}>
              <NavButton
                active={route?.route.key === "DASHBOARD"}
                route="/dashboard"
                title="Dashboard"
                onClick={onClose}
              />
            </ListItem>
            <Divider bgColor="inactive" />
            <ListItem textAlign="center" py={3}>
              <NavButton
                active={route?.route.key === "GALLERY"}
                route="/gallery"
                title="Gallery"
                onClick={onClose}
              />
            </ListItem>
            <Divider bgColor="inactive" />
            <ListItem textAlign="center" py={3}>
              <MobileNavTablelandConnectButton onClick={onClose} />
            </ListItem>
          </List>
        </DrawerBody>
      </DrawerContent>
    </Drawer>
  );
};

export const Topbar = () => {
  const route = useCurrentRoute();

  const isEnter = route?.route.key === "ENTER";
  const bgColor = isEnter ? "primaryLight" : "primary";

  const {
    isOpen: isSearchOpen,
    onClose: onSearchClose,
    onOpen: onSearchOpen,
  } = useDisclosure();
  const {
    isOpen: isDrawerOpen,
    onClose: onDrawerClose,
    onOpen: onDrawerOpen,
  } = useDisclosure();

  return (
    <>
      <MobileDrawer isOpen={isDrawerOpen} onClose={onDrawerClose} />
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
        <SearchModal isOpen={isSearchOpen} onClose={onSearchClose} />
        <Link to="/dashboard">
          <Box sx={{ maxWidth: { base: "50px", md: "100%" } }} mr={2}>
            <Logo />
          </Box>
        </Link>
        <Show above="lg">
          <Text variant="orbitron" fontSize="20">
            Garage
          </Text>
        </Show>
        <Show below="md">
          <Text variant="orbitron" fontSize="20">
            Garage
          </Text>
        </Show>
        {isEnter && (
          <>
            <Spacer />
            <TablelandConnectButton />
          </>
        )}
        {!isEnter && (
          <Flex
            justify={{ base: "end", md: "space-between" }}
            align="center"
            width="100%"
            gap={2}
            ml={{ base: 2, md: 8 }}
          >
            <Show above="md">
              <HStack>
                <NavButton
                  active={route?.route.key === "DASHBOARD"}
                  route="/dashboard"
                  title="Dashboard"
                />
                <NavButton
                  active={route?.route.key === "GALLERY"}
                  route="/gallery"
                  title="Gallery"
                />
              </HStack>
              <HStack flexShrink="0" flexGrow="1" justify="end">
                <RigSearchForm />
                <TablelandConnectButton />
              </HStack>
            </Show>
            <Show below="md">
              <IconButton
                aria-label="Search rig"
                onClick={onSearchOpen}
                variant="outline"
                color="paper"
                borderColor="inactive"
                icon={<SearchIcon />}
              />
              <IconButton
                aria-label="Open menu"
                onClick={onDrawerOpen}
                variant="outline"
                color="primary"
                bgColor="paper"
                _hover={{ bgColor: "bg", color: "primary" }}
                icon={<HamburgerIcon />}
              />
            </Show>
          </Flex>
        )}
      </Flex>
    </>
  );
};
