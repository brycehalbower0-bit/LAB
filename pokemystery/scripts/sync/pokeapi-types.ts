/** Minimal typings for the PokéAPI payloads the pipeline consumes. */

export interface NamedRef {
  name: string;
  url: string;
}

export interface RawPokemon {
  id: number;
  name: string;
  base_experience: number | null;
  height: number; // decimeters
  weight: number; // hectograms
  species: NamedRef;
  abilities: { ability: NamedRef; is_hidden: boolean; slot: number }[];
  types: { slot: number; type: NamedRef }[];
  stats: { base_stat: number; stat: NamedRef }[];
  sprites: {
    front_default: string | null;
    other?: { 'official-artwork'?: { front_default: string | null } };
  };
}

export interface RawSpecies {
  id: number;
  name: string;
  gender_rate: number;
  is_baby: boolean;
  is_legendary: boolean;
  is_mythical: boolean;
  color: NamedRef | null;
  shape: NamedRef | null;
  habitat: NamedRef | null;
  growth_rate: NamedRef | null;
  generation: NamedRef;
  egg_groups: NamedRef[];
  evolution_chain: { url: string } | null;
  names: { language: NamedRef; name: string }[];
  varieties: { is_default: boolean; pokemon: NamedRef }[];
}

export interface RawChainLink {
  species: NamedRef;
  evolves_to: RawChainLink[];
  evolution_details: { trigger: NamedRef | null; [key: string]: unknown }[];
}

export interface RawEvolutionChain {
  id: number;
  chain: RawChainLink;
}
