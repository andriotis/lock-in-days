import { fromDayKey, type DayKey } from "./dates";

export interface Quote {
  text: string;
  author: string;
  tag: "Stoicism" | "Philosophy" | "Psychology" | "Arts";
}

// A small, hand-picked set from philosophy, psychology, and the arts. Chosen to
// be motivating for a focused stretch of work. Attributions use the name the
// quote is most commonly and reliably published under.
export const QUOTES: Quote[] = [
  { text: "You have power over your mind — not outside events. Realize this, and you will find strength.", author: "Marcus Aurelius", tag: "Stoicism" },
  { text: "The impediment to action advances action. What stands in the way becomes the way.", author: "Marcus Aurelius", tag: "Stoicism" },
  { text: "Waste no more time arguing about what a good man should be. Be one.", author: "Marcus Aurelius", tag: "Stoicism" },
  { text: "We suffer more often in imagination than in reality.", author: "Seneca", tag: "Stoicism" },
  { text: "It is not that we have a short time to live, but that we waste a lot of it.", author: "Seneca", tag: "Stoicism" },
  { text: "No man is free who is not master of himself.", author: "Epictetus", tag: "Stoicism" },
  { text: "First say to yourself what you would be; and then do what you have to do.", author: "Epictetus", tag: "Stoicism" },

  { text: "He who has a why to live can bear almost any how.", author: "Friedrich Nietzsche", tag: "Philosophy" },
  { text: "The unexamined life is not worth living.", author: "Socrates", tag: "Philosophy" },
  { text: "We are what we repeatedly do. Excellence, then, is not an act, but a habit.", author: "Will Durant", tag: "Philosophy" },
  { text: "A journey of a thousand miles begins with a single step.", author: "Lao Tzu", tag: "Philosophy" },
  { text: "It does not matter how slowly you go as long as you do not stop.", author: "Confucius", tag: "Philosophy" },
  { text: "Life can only be understood backwards; but it must be lived forwards.", author: "Søren Kierkegaard", tag: "Philosophy" },
  { text: "One must imagine Sisyphus happy.", author: "Albert Camus", tag: "Philosophy" },
  { text: "We must be willing to let go of the life we planned so as to have the life that is waiting for us.", author: "Joseph Campbell", tag: "Philosophy" },
  { text: "Knowing is not enough; we must apply. Willing is not enough; we must do.", author: "Johann Wolfgang von Goethe", tag: "Philosophy" },

  { text: "When we are no longer able to change a situation, we are challenged to change ourselves.", author: "Viktor E. Frankl", tag: "Psychology" },
  { text: "Everything can be taken from a man but one thing: to choose one's attitude in any given set of circumstances.", author: "Viktor E. Frankl", tag: "Psychology" },
  { text: "Until you make the unconscious conscious, it will direct your life and you will call it fate.", author: "Carl Jung", tag: "Psychology" },
  { text: "The privilege of a lifetime is to become who you truly are.", author: "Carl Jung", tag: "Psychology" },
  { text: "Nothing is so fatiguing as the eternal hanging on of an uncompleted task.", author: "William James", tag: "Psychology" },
  { text: "Act as if what you do makes a difference. It does.", author: "William James", tag: "Psychology" },
  { text: "In any given moment we have two options: to step forward into growth or to step back into safety.", author: "Abraham Maslow", tag: "Psychology" },
  { text: "The curious paradox is that when I accept myself just as I am, then I can change.", author: "Carl Rogers", tag: "Psychology" },
  { text: "Becoming is better than being.", author: "Carol S. Dweck", tag: "Psychology" },
  { text: "Nothing in life is as important as you think it is while you are thinking about it.", author: "Daniel Kahneman", tag: "Psychology" },

  { text: "Great things are done by a series of small things brought together.", author: "Vincent van Gogh", tag: "Arts" },
  { text: "I dream my painting and I paint my dream.", author: "Vincent van Gogh", tag: "Arts" },
  { text: "The greatest danger for most of us is not that our aim is too high and we miss it, but that it is too low and we reach it.", author: "Michelangelo", tag: "Arts" },
  { text: "There is no greater agony than bearing an untold story inside you.", author: "Maya Angelou", tag: "Arts" },
  { text: "Nothing will work unless you do.", author: "Maya Angelou", tag: "Arts" },
  { text: "Let everything happen to you: beauty and terror. Just keep going. No feeling is final.", author: "Rainer Maria Rilke", tag: "Arts" },
  { text: "Simplicity is the ultimate sophistication.", author: "Leonardo da Vinci", tag: "Arts" },
  { text: "To play a wrong note is insignificant; to play without passion is inexcusable.", author: "Ludwig van Beethoven", tag: "Arts" },
  { text: "Don't only practice your art, but force your way into its secrets.", author: "Ludwig van Beethoven", tag: "Arts" },
];

/** Pick a stable quote for a given calendar day (advances by one each day). */
export function quoteForDay(dayKey: DayKey): Quote {
  const dayNumber = Math.floor(fromDayKey(dayKey).getTime() / 86_400_000);
  const idx = ((dayNumber % QUOTES.length) + QUOTES.length) % QUOTES.length;
  return QUOTES[idx];
}
