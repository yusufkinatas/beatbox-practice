/* Draft tips, one per check and sound, drafted from tutorials. Sources and quotes: TIPS.md. The owner reviews them in the design phase (PLAN.md decision 31). */
import type { CheckId, Sound } from './judge.ts';

export const TIPS: Record<CheckId, Partial<Record<Sound, string>>> = {
  loud: {
    B: 'Louder. Make the "b" tight and powerful, or move closer to the mic.',
    t: 'Louder. Build a little pressure behind your tongue tip, then snap it off, or move closer to the mic.',
    K: 'Louder. Tighten your throat and force the "k" out, or move closer to the mic.',
  },
  vowel: {
    B: 'No "buh". Keep only the lip pop and stop before any vowel. Think "boo" without the "oo".',
    t: 'No "tuh". Keep only the tongue tap, like the "t" at the end of "hat".',
    K: 'No "kuh". Keep only the click at the back of your tongue, like the "ck" at the end of "kick".',
  },
  air: {
    B: 'Less air. Use the pressure in your mouth, not your lungs, for one short pop.',
    t: 'Shorter. Snap the "t" off and stop the air. A long "tsss" is an open hi-hat.',
    K: 'Less air. Let only a small puff out with the "k", then stop.',
  },
  voice: {
    t: 'Whisper the "t", with no voice. A hand on your throat should feel no buzz.',
    K: 'Whisper the "k", with no voice. A hand on your throat should feel no buzz.',
  },
  low: { B: 'Deeper. Press the insides of your lips together, purse them a little, and pop from the center.' },
  punch: { B: 'Sharper. Build up pressure behind closed lips, then release it all at once, like an explosion.' },
};

export const HOW: Record<Sound, string> = {
  B: 'Press your lips together, build pressure, and let them burst open on a "b". No vowel after it.',
  t: 'Put your tongue tip behind your top front teeth and snap it down on a short, whispered "t".',
  K: 'Press the back of your tongue to the roof of your mouth, then force out a short, whispered "k".',
};

export const VETO: Record<Sound, string> = {
  B: 'Not a kick: no low end.',
  t: 'Not a hi-hat: no high hiss.',
  K: 'Not a snare: too much low end.',
};

export const NONE = 'Make one short B, t or K, with a pause before and after.';
export const UNSURE = 'Make it again, a little louder and clearer, on its own.';
