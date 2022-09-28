import { Rig, Attribute } from "../types";

type RigRow = [string, string, string, string, string, object];

export const rigFromRow = ([
  id,
  image,
  imageAlpha,
  thumb,
  thumbAlpha,
  attributes,
]: RigRow): Rig => ({
  id,
  image,
  imageAlpha,
  thumb,
  thumbAlpha,
  attributes: attributes as Attribute[],
});

