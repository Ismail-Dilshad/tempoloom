# Control over the look: lock, readability, voice-reactive text, the style mixer

## Lock what you like

On the Studio page, under a step's video, **Lock what you like** has a button for every scene.
Locked scenes are final: every later round keeps them exactly (their words, timing and visual).
A step whose video changed a locked scene cannot finish, whatever the agent says; a comment on a
locked scene is refused until you unlock it. Only you lock and unlock.

```sh
pnpm tempoloom studio lock JOB 2,5
pnpm tempoloom studio unlock JOB 5
```

The agent is told which scenes are locked when it starts any step, and gives their scene visuals
`"keep": true` so the art director never redesigns them.

## Readability check

Every preview now watches each scene from start to end, the way it will be seen on a phone held
upright (a 1080-pixel-wide video is about 390 points wide there), and checks every text:

| Check | Soft | Hard |
| --- | --- | --- |
| Size on a phone | under 12 pt | under 9 pt |
| Time on screen | under the time its words need (0.3 s a word, plus half a second, at least a second) | under half of it |
| Contrast and the platforms' button areas | as before | as before |

A counting number and text being typed are followed as one text. The problems are in the preview's
quality report with the scene and the text, so they are fixed before anyone looks.

## Text that reacts to the voice

Captions whose words react to how they are said: each word grows as it is spoken, as much as it is
stressed (louder than the speaker's usual and held longer); the most stressed are lit in the
highlight colour, and shouted ones shake.

- The built-in caption style **Reacts to the voice** (`loud`), or `"react": 0.8` (0 to 1) on any
  captions operation.
- It reads the sound of the video it captions; with word timings (from a transcript) every word
  reacts exactly when it is said.

## Style mixer

Blend two styles you taught: looks (`look learn`) or taught videos (by their id).

```sh
pnpm tempoloom look mix calm-paper fast-dark --weight 0.7     # 70% the first, 30% the second
pnpm tempoloom make SCRIPT.txt --like mix-calm-paper-fast-dark-70
```

On the page: New video, **Mix two styles I taught**, choose the two and move the slider. Every
measured number (brightness, motion energy, cut pace, scene length, headline size, colours) is mixed
by the shares; each style trait keeps its share of the pull (so 70% of a strong nudge is still a
nudge); a choice that cannot be mixed (the music's mood, which side the text sits) comes from the
bigger share. The mix is saved as a look and used like any other: it steers, it never copies.
