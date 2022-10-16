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

export const useRigImageUrls = (rig: Partial<Rig>): RigImageUrls => {
  let result: RigImageUrls = {};

  if (rig.image) {
    result.image = ipfsUriToGatewayUrl(rig.image);
  }
  if (rig.imageAlpha) {
    result.imageAlpha = ipfsUriToGatewayUrl(rig.imageAlpha);
  }
  if (rig.thumb) {
    result.thumb = ipfsUriToGatewayUrl(rig.thumb);
  }
  if (rig.thumbAlpha) {
    result.thumbAlpha = ipfsUriToGatewayUrl(rig.thumbAlpha);
  }

  return result;
};
