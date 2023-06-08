import { createHelia } from "helia";

const node = await createHelia();

export const useHelia = () => {
  return { node };
};
