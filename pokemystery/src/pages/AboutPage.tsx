export function AboutPage() {
  return (
    <div className="card">
      <h1>About &amp; attribution</h1>

      <h2>What is this?</h2>
      <p>
        PokéMystery is a free fan-made guessing game. In one mode a Bayesian engine asks you
        yes-or-no questions and works out which Pokémon you're thinking of; in the other, you
        interrogate the game about a secret Pokémon using plain English.
      </p>

      <h2>Data sources</h2>
      <p>
        All Pokémon data (names, types, sizes, evolution chains, colors, shapes, and more) comes
        from <a href="https://pokeapi.co/">PokéAPI</a>, the free and open Pokémon API, and is
        imported into our own database — games never query PokéAPI directly. Sprites and artwork
        are loaded from the <a href="https://github.com/PokeAPI/sprites">PokeAPI sprites</a>{' '}
        repository and are shown only after a game ends (you can turn this off in settings).
      </p>
      <p>
        Body-shape and color traits are derived from PokéAPI species metadata; subjective traits
        (like “cute”) are curated by hand and marked as opinions, not facts. Spotted a mistake? Use
        “Report a problem” at the end of a game.
      </p>

      <h2>Legal</h2>
      <p>
        PokéMystery is an unofficial fan project and is not affiliated with, endorsed by, or
        sponsored by Nintendo, Game Freak, Creatures, or The Pokémon Company. Pokémon and all
        Pokémon character names are trademarks of Nintendo. This project uses no official logos or
        proprietary artwork of the Pokémon brand; Pokémon names and sprite references are used only
        as factual game data via PokéAPI.
      </p>

      <h2>Privacy</h2>
      <p>
        No accounts, no tracking. Game sessions are stored server-side under a random token and
        expire after 24 hours. Your settings and theme live in your browser only.
      </p>
    </div>
  );
}
