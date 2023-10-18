import React, { useCallback, useContext, useMemo, useState } from "react";
import { Rig } from "~/types";
import { TrainRigsModal, PilotRigsModal, ParkRigsModal } from "./FlyParkModals";

type OnTransactionSubmittedCallback = (txHash: string) => void;

interface Modal {
  openModal: (
    rigs: Rig[],
    onTransactionSubmitted?: OnTransactionSubmittedCallback
  ) => void;
  closeModal: () => void;
}

interface GlobalFlyParkModalContextData {
  trainRigsModal: Modal;
  pilotRigsModal: Modal;
  parkRigsModal: Modal;
}

const emptyModal: Modal = {
  openModal: () => {},
  closeModal: () => {},
};

const GlobalFlyParkModalContext =
  React.createContext<GlobalFlyParkModalContextData>({
    trainRigsModal: emptyModal,
    pilotRigsModal: emptyModal,
    parkRigsModal: emptyModal,
  });

interface ModalState {
  open: boolean;
  rigs: Rig[];
  onTransactionSubmitted?: OnTransactionSubmittedCallback;
}

const useModalState = () => {
  const [modalState, setModalState] = useState<ModalState>({
    open: false,
    rigs: [],
  });

  const openModal = useCallback(
    (rigs: Rig[], onTransactionSubmitted?: OnTransactionSubmittedCallback) => {
      setModalState((old) => {
        if (old.open) return old;

        return {
          open: true,
          rigs,
          onTransactionSubmitted,
        };
      });
    },
    [setModalState]
  );

  const closeModal = useCallback(() => {
    setModalState({ open: false, rigs: [] });
  }, [setModalState]);

  const result = useMemo(() => {
    return {
      ...modalState,
      openModal,
      closeModal,
    };
  }, [openModal, closeModal, modalState]);

  return result;
};

export const GlobalFlyParkModals = ({ children }: React.PropsWithChildren) => {
  const trainRigsModal = useModalState();
  const pilotRigsModal = useModalState();
  const parkRigsModal = useModalState();

  const value = useMemo(() => {
    return {
      trainRigsModal,
      pilotRigsModal,
      parkRigsModal,
    };
  }, [trainRigsModal, pilotRigsModal, parkRigsModal]);

  return (
    <GlobalFlyParkModalContext.Provider value={value}>
      <TrainRigsModal
        rigs={trainRigsModal.rigs}
        isOpen={trainRigsModal.open}
        onClose={trainRigsModal.closeModal}
        onTransactionSubmitted={trainRigsModal.onTransactionSubmitted}
      />
      <PilotRigsModal
        rigs={pilotRigsModal.rigs}
        isOpen={pilotRigsModal.open}
        onClose={pilotRigsModal.closeModal}
        onTransactionSubmitted={pilotRigsModal.onTransactionSubmitted}
      />
      <ParkRigsModal
        rigs={parkRigsModal.rigs}
        isOpen={parkRigsModal.open}
        onClose={parkRigsModal.closeModal}
        onTransactionSubmitted={parkRigsModal.onTransactionSubmitted}
      />
      {children}
    </GlobalFlyParkModalContext.Provider>
  );
};

export const useGlobalFlyParkModals = () =>
  useContext(GlobalFlyParkModalContext);
