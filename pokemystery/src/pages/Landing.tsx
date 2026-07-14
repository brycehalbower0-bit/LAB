import { navigate } from '../lib/router';

export function Landing() {
  return (
    <>
      <section className="hero">
        <h1>PokéMystery</h1>
        <p className="tagline">
          A Pokémon guessing duel. Let the AI read your mind with clever yes-or-no questions — or
          interrogate it to uncover its secret Pokémon.
        </p>
      </section>

      <div className="mode-grid">
        <button type="button" className="mode-card" onClick={() => navigate('play-ai')}>
          <span className="emoji" aria-hidden="true">
            🔮
          </span>
          <h2>AI Guesses Your Pokémon</h2>
          <p>
            Think of any Pokémon. Answer yes-or-no questions and watch the AI narrow down over a
            thousand possibilities to yours.
          </p>
        </button>
        <button type="button" className="mode-card" onClick={() => navigate('play-guess')}>
          <span className="emoji" aria-hidden="true">
            🕵️
          </span>
          <h2>You Guess the Pokémon</h2>
          <p>
            The game picks a secret Pokémon. Ask questions in plain English — “Is it a Water type?”
            — and figure it out before your guesses run out.
          </p>
        </button>
      </div>

      <section className="how-to card">
        <h2>How to play</h2>
        <ol>
          <li>
            Pick a mode above. Adjust <a href="#/settings">settings</a> first if you want to limit
            generations, exclude legendaries, or change difficulty.
          </li>
          <li>
            In <strong>AI Guesses</strong>, silently choose a Pokémon and answer honestly — “probably”
            and “I don’t know” are fine. You can undo an answer at any time.
          </li>
          <li>
            In <strong>You Guess</strong>, type natural questions or use the suggestions. When you’re
            confident, make a direct guess like “Is it Dragonair?”.
          </li>
          <li>Everything is powered by real Pokédex data — no cheating on either side.</li>
        </ol>
      </section>
    </>
  );
}
