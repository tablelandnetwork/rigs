export interface Attribute { display_type: string; trait_type: string; value: any }

export interface Rig {
  id: string;
  image?: string;
  imageAlpha?: string;
  thumb?: string;
  thumbAlpha?: string;
  attributes?: Attribute[];
}
