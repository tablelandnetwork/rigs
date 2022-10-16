import { Rig } from "../types";
import { ipfsGatewayBaseUrl } from "../env";

const ipfsUriToGatewayUrl = (ipfsUri: string): string => {
  const cidAndPath = ipfsUri.match(/^ipfs:\/\/(.*)$/)![1];
  return `${ipfsGatewayBaseUrl}/ipfs/${cidAndPath}`;
};

interface RigImageUrls {
  image?: string;
  imageAlpha?: string;
  thumb?: string;
  thumbAlpha?: string;
}

// TODO(daniel): remove string .replace calls once the data in the looksup table is consistent with ipfs
export const useRigImageUrls = (rig: Partial<Rig>): RigImageUrls => {
  let result: RigImageUrls = {};

  if (rig.image) {
    result.image = ipfsUriToGatewayUrl(rig.image.replace("_full", ""));
  }
  if (rig.imageAlpha) {
    result.imageAlpha = ipfsUriToGatewayUrl(rig.imageAlpha.replace("_full", ""));
  }
  if (rig.thumb) {
    result.thumb = ipfsUriToGatewayUrl(rig.thumb.replace("image_", ""));
  }
  if (rig.thumbAlpha) {
    result.thumbAlpha = ipfsUriToGatewayUrl(rig.thumbAlpha.replace("image_", ""));
  }

  return result;
};
