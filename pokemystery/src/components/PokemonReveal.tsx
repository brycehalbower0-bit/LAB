import type { PokemonPublic } from '../../shared/api';

export function PokemonReveal({
  pokemon,
  showSprite,
  title,
}: {
  pokemon: PokemonPublic;
  showSprite: boolean;
  title: string;
}) {
  const art = pokemon.officialArtworkUrl ?? pokemon.spriteUrl;
  return (
    <div className="reveal">
      <h2>{title}</h2>
      {showSprite && art !== null ? (
        <img src={art} alt={`Sprite of ${pokemon.displayName}`} width={240} height={240} />
      ) : null}
      <div className="name">{pokemon.displayName}</div>
      <div className="type-badges">
        {pokemon.types.map((type) => (
          <span key={type} className="pill">
            {type}
          </span>
        ))}
        <span className="pill">Gen {pokemon.generation}</span>
      </div>
    </div>
  );
}
