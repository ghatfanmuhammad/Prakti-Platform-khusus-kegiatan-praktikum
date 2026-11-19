/**
 * Inferensi model sentimen (LinearSVC + TF-IDF) murni di JavaScript.
 * Tanpa panggilan jaringan dan tanpa modul native, jadi jalan di Expo Go.
 *
 * Port TypeScript dari `sentiment.js` bawaan model; logika dan hasilnya sama.
 */

export interface SentimentModel {
  schema_version: number;
  status: string;
  algorithm: string;
  labels: string[];
  aliases: Record<string, string>;
  vocabulary: Record<string, number>;
  idf: number[];
  weights: number[][];
  bias: number[];
  preprocessing: string;
}

export interface SentimentResult {
  /** null bila teks kosong atau tidak ada kata yang dikenali model. */
  label: string | null;
  status: 'predicted' | 'unknown_vocabulary' | 'empty_input';
  /** Margin keputusan per label (bukan probabilitas). */
  scores: number[] | null;
  scoreType: 'decision_margin' | 'log_score' | 'none';
  experimental: boolean;
}

const PREPROCESSING_DIDUKUNG = [
  'ascii_lowercase_words_unigram_bigram_sublinear_tf_l2_v1',
  'unicode_nfkd_ascii_words_unigram_bigram_sublinear_tf_l2_v1',
];

const punya = (obj: object, key: string) => Object.prototype.hasOwnProperty.call(obj, key);

export function createSentimentClassifier(model: SentimentModel) {
  if (model.schema_version !== 1 || !PREPROCESSING_DIDUKUNG.includes(model.preprocessing)) {
    throw new Error('Unsupported sentiment model format');
  }

  return function classify(text: string): SentimentResult {
    if (typeof text !== 'string') throw new TypeError('text must be a string');

    const normalized = model.preprocessing.startsWith('unicode_')
      ? text
          .replace(/<[^>]*>/g, ' ')
          .normalize('NFKD')
          .replace(/[̀-ͯ]/g, '')
          .toLowerCase()
      : text.toLowerCase();

    const words = (normalized.match(/[a-z0-9]+/g) ?? []).map((w) =>
      punya(model.aliases, w) ? model.aliases[w] : w,
    );
    const grams = words.concat(words.slice(1).map((w, i) => `${words[i]} ${w}`));

    const counts = new Map<number, number>();
    for (const gram of grams) {
      if (punya(model.vocabulary, gram)) {
        const index = model.vocabulary[gram];
        counts.set(index, (counts.get(index) ?? 0) + 1);
      }
    }

    if (counts.size === 0) {
      return {
        label: null,
        status: words.length ? 'unknown_vocabulary' : 'empty_input',
        scores: null,
        scoreType: 'none',
        experimental: true,
      };
    }

    const values = Array.from(counts, ([i, count]): [number, number] => [
      i,
      (1 + Math.log(count)) * model.idf[i],
    ]);
    const norm = Math.sqrt(values.reduce((sum, [, v]) => sum + v ** 2, 0));
    const scores = model.weights.map((weights, c) =>
      values.reduce((score, [i, value]) => score + (weights[i] * value) / norm, model.bias[c]),
    );
    const best = scores.indexOf(Math.max(...scores));

    return {
      label: model.labels[best],
      status: 'predicted',
      scores,
      scoreType: model.algorithm === 'LinearSVC' ? 'decision_margin' : 'log_score',
      experimental: model.status !== 'production',
    };
  };
}
