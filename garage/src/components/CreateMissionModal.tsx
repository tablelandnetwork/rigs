import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Result } from "@tableland/sdk";
import {
  Button,
  FormControl,
  FormLabel,
  Heading,
  HStack,
  IconButton,
  Input,
  Textarea,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
  Table,
  Tbody,
  Td,
  Text,
  Thead,
  Th,
  Tr,
  useDisclosure,
  useToast,
} from "@chakra-ui/react";
import isEqual from "lodash/isEqual";
import { DeleteIcon } from "@chakra-ui/icons";
import { ChainAwareButton } from "./ChainAwareButton";
import { Database } from "@tableland/sdk";
import { useSigner } from "../hooks/useSigner";
import { isPresent } from "../utils/types";
import { Mission, MissionReward, MissionDeliverable } from "../types";
import { secondaryChain, deployment } from "../env";

const { missionsTable } = deployment;

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface FormState {
  name: string;
  description: string;
  tags: string[];
  requirements: string[];
  deliverables: MissionDeliverable[];
  rewards: MissionReward[];

  contributionsStartBlock: number;
  contributionsEndBlock: number;
  maxNumberOfContributions: number;
}

const initialFormState = {
  name: "",
  description: "",
  tags: [],
  requirements: [],
  deliverables: [],
  rewards: [{ amount: 0, currency: "" }],
  contributionsStartBlock: 0,
  contributionsEndBlock: 0,
  maxNumberOfContributions: 0,
};

const isValid = (state: FormState): boolean => {
  const { name, description, tags, requirements, deliverables, rewards } =
    state;
  return !!(
    name &&
    description &&
    tags.every(isPresent) &&
    requirements.every(isPresent) &&
    deliverables.every(
      ({ key, description, type }: MissionDeliverable) =>
        isPresent(key) && isPresent(description) && isPresent(type)
    ) &&
    rewards[0].amount > 0 &&
    rewards[0].currency
  );
};

const EMPTY_DELIVERABLE = {
  key: "",
  description: "",
  type: "",
};

const StateExportModal = ({
  state,
  isOpen,
  onClose,
}: {
  state: FormState;
  isOpen: boolean;
  onClose: () => void;
}) => {
  return (
    <Modal isOpen={isOpen} onClose={onClose} size="xl">
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Copy JSON</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <code
            style={{
              whiteSpace: "pre-wrap",
              background: "#ccc",
              borderRadius: "2px",
              color: "#333",
              padding: "12px",
              display: "block",
            }}
          >
            {JSON.stringify(state, null, 2)}
          </code>
        </ModalBody>
      </ModalContent>
    </Modal>
  );
};

const StateImportModal = ({
  isOpen,
  onClose,
  onImport,
}: {
  isOpen: boolean;
  onClose: () => void;
  onImport: (state: FormState) => void;
}) => {
  const [importStateJSON, setImportStateJSON] = useState("");

  const parsedJson = useMemo(() => {
    try {
      return JSON.parse(importStateJSON);
    } catch (_) {
      console.log();
    }
  }, [importStateJSON]);

  useEffect(() => {
    if (isOpen) setImportStateJSON("");
  }, [isOpen, setImportStateJSON]);

  const onImportClicked = useCallback(() => {
    if (parsedJson) {
      onImport(parsedJson);
      onClose();
    }
  }, [parsedJson, onClose]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="xl">
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Import form state JSON</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <Textarea
            minHeight="200px"
            placeholder="Paste saved JSON"
            value={importStateJSON}
            onChange={(e) => setImportStateJSON(e.target.value)}
          />
        </ModalBody>
        <ModalFooter>
          <Button isDisabled={!parsedJson} onClick={onImportClicked}>
            Import
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

type BaseModalProps = ModalProps & {
  title: string;
  isFormValid: boolean;
  formState: FormState;
  setFormState: React.Dispatch<React.SetStateAction<FormState>>;
  onMutate?: (formState: FormState) => Promise<Result<never>>;
};

const BaseMissionModal = ({
  isOpen,
  onClose,
  title,
  formState,
  setFormState,
  isFormValid,
  onMutate,
}: BaseModalProps) => {
  const toast = useToast();
  const {
    name,
    description,
    tags,
    requirements,
    deliverables,
    rewards,
    contributionsStartBlock,
    contributionsEndBlock,
    maxNumberOfContributions,
  } = formState;

  const [txnState, setTxnState] = useState<
    "idle" | "querying" | "success" | "fail"
  >("idle");

  const onSubmit = useCallback(async () => {
    if (!onMutate) return;

    setTxnState("querying");

    try {
      const { meta: insert } = await onMutate(formState);
      await insert.txn?.wait();
      setTxnState("success");
      toast({ title: "Success", status: "success", duration: 7_500 });
    } catch (e) {
      if (e instanceof Error) {
        if (!/user rejected transaction/.test(e.message)) {
          toast({
            title: "Insert failed",
            description: e.message,
            status: "error",
            duration: 7_500,
          });
          setTxnState("fail");
        } else {
          setTxnState("idle");
        }
      }
    }
  }, [onMutate, formState, setTxnState, toast]);

  const onNameInputChanged = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setFormState((old) => ({ ...old, name: e.target.value }));
    },
    [setFormState]
  );

  const onDescriptionInputChanged = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setFormState((old) => ({ ...old, description: e.target.value }));
    },
    [setFormState]
  );

  const onMaxContributionsInputChanged = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = parseInt(e.target.value);
      setFormState((old) => ({
        ...old,
        maxNumberOfContributions: isNaN(value) ? 0 : value,
      }));
    },
    [setFormState]
  );

  const onStartInputChanged = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = parseInt(e.target.value);
      setFormState((old) => ({
        ...old,
        contributionsStartBlock: isNaN(value) ? 0 : value,
      }));
    },
    [setFormState]
  );

  const onEndInputChanged = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = parseInt(e.target.value);
      setFormState((old) => ({
        ...old,
        contributionsEndBlock: isNaN(value) ? 0 : value,
      }));
    },
    [setFormState]
  );

  const addTag = useCallback(() => {
    setFormState((old) => ({
      ...old,
      tags: [...old.tags, ""],
    }));
  }, [setFormState]);

  const removeTag = useCallback(
    (index: number) => {
      setFormState((old) => {
        const newTags = [...old.tags];
        newTags.splice(index, 1);
        return {
          ...old,
          tags: newTags,
        };
      });
    },
    [setFormState]
  );

  const onTagInputChanged = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>, tIdx: number) => {
      const value = e.target.value;

      setFormState((old) => ({
        ...old,
        tags: old.tags.map((v, idx) => (idx === tIdx ? value : v)),
      }));
    },
    [setFormState]
  );

  const addRequirement = useCallback(() => {
    setFormState((old) => ({
      ...old,
      requirements: [...old.requirements, ""],
    }));
  }, [setFormState]);

  const removeRequirement = useCallback(
    (index: number) => {
      setFormState((old) => {
        const newRequirements = [...old.requirements];
        newRequirements.splice(index, 1);
        return {
          ...old,
          requirements: newRequirements,
        };
      });
    },
    [setFormState]
  );

  const onRequirementInputChanged = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>, rIdx: number) => {
      const value = e.target.value;

      setFormState((old) => ({
        ...old,
        requirements: old.requirements.map((v, idx) =>
          idx === rIdx ? value : v
        ),
      }));
    },
    [setFormState]
  );

  const addDeliverable = useCallback(() => {
    setFormState((old) => ({
      ...old,
      deliverables: [...old.deliverables, EMPTY_DELIVERABLE],
    }));
  }, [setFormState]);

  const removeDeliverable = useCallback(
    (index: number) => {
      setFormState((old) => {
        const newDeliverables = [...old.deliverables];
        newDeliverables.splice(index, 1);
        return {
          ...old,
          deliverables: newDeliverables,
        };
      });
    },
    [setFormState]
  );

  const onDeliverableKeyInputChanged = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>, dIdx: number) => {
      const key = e.target.value;

      setFormState((old) => ({
        ...old,
        deliverables: old.deliverables.map((v, idx) =>
          idx === dIdx ? { ...v, key } : v
        ),
      }));
    },
    [setFormState]
  );

  const onDeliverableDescriptionInputChanged = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>, dIdx: number) => {
      const description = e.target.value;

      setFormState((old) => ({
        ...old,
        deliverables: old.deliverables.map((v, idx) =>
          idx === dIdx ? { ...v, description } : v
        ),
      }));
    },
    [setFormState]
  );

  const onDeliverableTypeInputChanged = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>, dIdx: number) => {
      const type = e.target.value;

      setFormState((old) => ({
        ...old,
        deliverables: old.deliverables.map((v, idx) =>
          idx === dIdx ? { ...v, type } : v
        ),
      }));
    },
    [setFormState]
  );

  const onRewardAmountInputChanged = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = parseInt(e.target.value);
      setFormState((old) => ({
        ...old,
        rewards: [{ ...old.rewards[0], amount: isNaN(value) ? 0 : value }],
      }));
    },
    [setFormState]
  );

  const onRewardCurrencyInputChanged = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const currency = e.target.value;
      setFormState((old) => ({
        ...old,
        rewards: [{ ...old.rewards[0], currency }],
      }));
    },
    [setFormState]
  );

  useEffect(() => {
    if (isOpen) {
      setTxnState("idle");
    }
  }, [isOpen, setTxnState]);

  const {
    isOpen: exportIsOpen,
    onOpen: exportOnOpen,
    onClose: exportOnClose,
  } = useDisclosure();

  const {
    isOpen: importIsOpen,
    onOpen: importOnOpen,
    onClose: importOnClose,
  } = useDisclosure();

  return (
    <>
      <StateExportModal
        state={formState}
        isOpen={exportIsOpen}
        onClose={exportOnClose}
      />
      <StateImportModal
        isOpen={importIsOpen}
        onClose={importOnClose}
        onImport={(state) => setFormState(state)}
      />

      <Modal isOpen={isOpen} onClose={onClose} size="xl">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>{title}</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <FormControl>
              <FormLabel>Name:</FormLabel>
              <Input
                focusBorderColor="primary"
                variant="outline"
                value={name}
                onChange={onNameInputChanged}
                isInvalid={name === ""}
                size="md"
                mb={4}
              />
            </FormControl>
            <FormControl>
              <FormLabel>Description:</FormLabel>
              <Input
                focusBorderColor="primary"
                variant="outline"
                value={description}
                onChange={onDescriptionInputChanged}
                isInvalid={description === ""}
                size="md"
                mb={4}
              />
            </FormControl>

            <Heading mt={4}>
              <HStack justify="space-between">
                <Text>Tags:</Text>
                <Button onClick={addTag}>Add</Button>
              </HStack>
            </Heading>

            <Table mt={2} mb={8}>
              <Thead>
                <Tr>
                  <Th>Tag</Th>
                  <Th isNumeric>Delete</Th>
                </Tr>
              </Thead>

              <Tbody>
                {tags.map((tag, index) => (
                  <Tr key={`tag-${index}`}>
                    <Td>
                      <Input
                        focusBorderColor="primary"
                        type="text"
                        variant="outline"
                        value={tag}
                        onChange={(e) => onTagInputChanged(e, index)}
                        isInvalid={tag === ""}
                        size="md"
                      />
                    </Td>
                    <Td isNumeric>
                      <IconButton
                        aria-label="Delete tag"
                        icon={<DeleteIcon />}
                        onClick={() => removeTag(index)}
                      />
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>

            <Heading mt={4}>
              <HStack justify="space-between">
                <Text>Requirements:</Text>
                <Button onClick={addRequirement}>Add</Button>
              </HStack>
            </Heading>

            <Table mt={2} mb={8}>
              <Thead>
                <Tr>
                  <Th>Requirement</Th>
                  <Th isNumeric>Delete</Th>
                </Tr>
              </Thead>

              <Tbody>
                {requirements.map((requirement, index) => (
                  <Tr key={`requirement-${index}`}>
                    <Td>
                      <Input
                        focusBorderColor="primary"
                        type="text"
                        variant="outline"
                        value={requirement}
                        onChange={(e) => onRequirementInputChanged(e, index)}
                        isInvalid={requirement === ""}
                        size="md"
                      />
                    </Td>
                    <Td isNumeric>
                      <IconButton
                        aria-label="Delete requirement"
                        icon={<DeleteIcon />}
                        onClick={() => removeRequirement(index)}
                      />
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>

            <Heading mt={4}>
              <HStack justify="space-between">
                <Text>Deliverables:</Text>
                <Button onClick={addDeliverable}>Add</Button>
              </HStack>
            </Heading>

            <Table mt={2} mb={8}>
              <Thead>
                <Tr>
                  <Th>Key</Th>
                  <Th>Description</Th>
                  <Th>Type</Th>
                  <Th isNumeric>Delete</Th>
                </Tr>
              </Thead>

              <Tbody>
                {deliverables.map(({ key, description, type }, index) => (
                  <Tr key={`deliverable-${index}`}>
                    <Td>
                      <Input
                        focusBorderColor="primary"
                        type="text"
                        variant="outline"
                        value={key}
                        onChange={(e) => onDeliverableKeyInputChanged(e, index)}
                        isInvalid={key === ""}
                        size="md"
                      />
                    </Td>
                    <Td>
                      <Input
                        focusBorderColor="primary"
                        type="text"
                        variant="outline"
                        value={description}
                        onChange={(e) =>
                          onDeliverableDescriptionInputChanged(e, index)
                        }
                        isInvalid={description === ""}
                        size="md"
                      />
                    </Td>
                    <Td>
                      <Input
                        focusBorderColor="primary"
                        type="text"
                        variant="outline"
                        value={type}
                        onChange={(e) =>
                          onDeliverableTypeInputChanged(e, index)
                        }
                        isInvalid={type === ""}
                        size="md"
                      />
                    </Td>
                    <Td isNumeric>
                      <IconButton
                        aria-label="Delete deliverable"
                        icon={<DeleteIcon />}
                        onClick={() => removeDeliverable(index)}
                      />
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
            <Heading mt={4} mb={2}>
              Reward
            </Heading>
            <FormControl>
              <FormLabel>Amount:</FormLabel>
              <Input
                focusBorderColor="primary"
                type="number"
                variant="outline"
                placeholder="Amount"
                value={rewards[0].amount}
                onChange={onRewardAmountInputChanged}
                size="md"
                mb={4}
              />
            </FormControl>
            <FormControl>
              <FormLabel>Currency:</FormLabel>
              <Input
                focusBorderColor="primary"
                variant="outline"
                placeholder="Currency"
                value={rewards[0].currency}
                onChange={onRewardCurrencyInputChanged}
                size="md"
                mb={4}
              />
            </FormControl>

            <Heading mt={4} mb={2}>
              Availability
            </Heading>
            <FormControl>
              <FormLabel>Start block (optional):</FormLabel>
              <Input
                focusBorderColor="primary"
                type="number"
                variant="outline"
                value={contributionsStartBlock ?? ""}
                onChange={onStartInputChanged}
                size="md"
                mb={4}
              />
            </FormControl>
            <FormControl>
              <FormLabel>End block (optional):</FormLabel>
              <Input
                focusBorderColor="primary"
                type="number"
                variant="outline"
                value={contributionsEndBlock ?? ""}
                onChange={onEndInputChanged}
                size="md"
                mb={4}
              />
            </FormControl>
            <FormControl>
              <FormLabel>
                Max number of accepted contributions (optional):
              </FormLabel>
              <Input
                focusBorderColor="primary"
                type="number"
                variant="outline"
                value={maxNumberOfContributions ?? ""}
                onChange={onMaxContributionsInputChanged}
                size="md"
                mb={4}
              />
            </FormControl>
          </ModalBody>
          <ModalFooter>
            <HStack gap={2}>
              <Button onClick={exportOnOpen}>Save JSON</Button>
              <Button onClick={importOnOpen}>Load JSON</Button>
              <ChainAwareButton
                expectedChain={secondaryChain}
                isDisabled={
                  ["querying", "success"].includes(txnState) || !isFormValid
                }
                onClick={onSubmit}
                isLoading={txnState === "querying"}
              >
                Submit
              </ChainAwareButton>
              <Button
                variant="ghost"
                onClick={onClose}
                isDisabled={txnState === "querying"}
              >
                {txnState === "success" ? "Close" : "Cancel"}
              </Button>
            </HStack>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
};

export const CreateMissionModal = ({ isOpen, onClose }: ModalProps) => {
  const signer = useSigner({ chainId: secondaryChain.id });

  const db = useMemo(() => {
    if (signer) return new Database({ signer });
  }, [signer]);

  const [formState, setFormState] = useState<FormState>(initialFormState);

  const isFormValid = useMemo(() => isValid(formState), [formState]);

  const mutate = db
    ? (state: FormState) => {
        const {
          name,
          description,
          tags,
          requirements,
          deliverables,
          rewards,
          contributionsStartBlock,
          contributionsEndBlock,
          maxNumberOfContributions,
        } = state;

        return db
          .prepare(
            `INSERT INTO ${missionsTable} (name, description, tags, requirements, deliverables, rewards, contributions_start_block, contributions_end_block, max_number_of_contributions, contributions_disabled) VALUES (?, ?, JSON(?), JSON(?), JSON(?), JSON(?), ?, ?, ?, 0)`
          )
          .bind(
            name,
            description,
            JSON.stringify(tags),
            JSON.stringify(requirements),
            JSON.stringify(deliverables),
            JSON.stringify(rewards),
            contributionsStartBlock,
            contributionsEndBlock,
            maxNumberOfContributions
          )
          .run();
      }
    : undefined;

  useEffect(() => {
    if (isOpen) {
      setFormState(initialFormState);
    }
  }, [isOpen, setFormState]);

  return (
    <BaseMissionModal
      title="Create Mission"
      formState={formState}
      setFormState={setFormState}
      isFormValid={isFormValid}
      isOpen={isOpen}
      onClose={onClose}
      onMutate={mutate}
    />
  );
};

type EditModalProps = { mission: Mission } & ModalProps;

export const EditMissionModal = ({
  isOpen,
  onClose,
  mission,
}: EditModalProps) => {
  const { id, contributionsDisabled, ...baseMission } = mission;
  const initialState = useMemo(
    () => ({
      contributionsStartBlock: 0,
      contributionsEndBlock: 0,
      maxNumberOfContributions: 0,
      ...baseMission,
    }),
    [baseMission]
  );

  const signer = useSigner({ chainId: secondaryChain.id });

  const db = useMemo(() => {
    if (signer) return new Database({ signer });
  }, [signer]);

  const mutate = db
    ? (state: FormState) => {
        const {
          name,
          description,
          tags,
          requirements,
          deliverables,
          rewards,
          contributionsStartBlock,
          contributionsEndBlock,
          maxNumberOfContributions,
        } = state;

        return db
          .prepare(
            `UPDATE ${missionsTable} SET name = ?, description = ?, tags = ?, requirements = ?, deliverables = ?, rewards = ?, contributions_start_block = ?, contributions_end_block = ?, max_number_of_contributions = ? WHERE id = ?`
          )
          .bind(
            name,
            description,
            JSON.stringify(tags),
            JSON.stringify(requirements),
            JSON.stringify(deliverables),
            JSON.stringify(rewards),
            contributionsStartBlock,
            contributionsEndBlock,
            maxNumberOfContributions,
            id
          )
          .run();
      }
    : undefined;

  const [formState, setFormState] = useState<FormState>(initialState);

  const isFormValid = useMemo(
    () => isValid(formState) && !isEqual(initialState, formState),
    [formState]
  );

  useEffect(() => {
    if (isOpen) {
      setFormState(initialState);
    }
  }, [isOpen, setFormState]);

  return (
    <BaseMissionModal
      title="Edit Mission"
      formState={formState}
      setFormState={setFormState}
      isFormValid={isFormValid}
      isOpen={isOpen}
      onClose={onClose}
      onMutate={mutate}
    />
  );
};
