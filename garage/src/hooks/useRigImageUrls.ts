import { Rig } from "../types";

const ipfsUriToGatewayUrl = (ipfsUri: string): string => {
  const match = ipfsUri.match(/^ipfs:\/\/([a-zA-Z0-9]*)\/(.*)$/);
  if (!match) return "";

  const [, cid, path] = match;
  return `https://${cid}.ipfs.nftstorage.link/${path}`;
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
