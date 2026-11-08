/**
 * Analysis providers.
 *
 * A provider turns a `DetectorContext` (the per-day Dataset plus period metadata) into
 * insights and notes. Today there is one provider, `RulesProvider`, which runs the
 * deterministic detectors in `detectors/`.
 *
 * Plugging in a future local-AI provider
 * --------------------------------------
 * Implement `AnalysisProvider` (e.g. `LocalModelProvider`) in this folder:
 *   - `name` is reported in `InsightsReport.provider` (e.g. "local-model-v1").
 *   - `analyze(ctx)` receives exactly the same `DetectorContext` - the `Dataset` is the
 *     only input a provider may use, so all data stays on the device. Return `Insight`
 *     objects with the same fields (stable `id`, `category`, `strength`, `title`/`text`/
 *     `explanation` in `ctx.locale` with hedged wording, full `evidence`) so the UI and the
 *     "why did I get this insight" panel work unchanged; put anything the model could not
 *     conclude into `notes`.
 *   - Pass the provider to `generateInsights(db, period, today, { provider })`, or compose it
 *     with `RulesProvider` (run both, merge insights - the engine dedupes by id and sorts by
 *     score). No change to the HTTP contract (`docs/API.md`) or to `shared/types.ts` is needed.
 * A provider must never throw: return an empty result with a note instead.
 */
import { t } from '@shared/i18n';
import type { Insight } from '@shared/types';
import { ALL_DETECTORS } from './detectors';
import type { Detector, DetectorContext } from './types';

export interface AnalysisResult {
  insights: Insight[];
  /** Notes for the user in `ctx.locale` (insufficient data, nothing notable, internal failures). */
  notes: string[];
}

export interface AnalysisProvider {
  /** Reported as `InsightsReport.provider`. */
  name: string;
  analyze(ctx: DetectorContext): AnalysisResult;
}

/**
 * Runs every rule-based detector. A detector that throws is isolated: its failure becomes
 * a note and the other detectors still run. `analyze` itself never throws.
 */
export class RulesProvider implements AnalysisProvider {
  readonly name = 'rules-v1';
  private readonly detectors: Detector[];

  constructor(detectors: Detector[] = ALL_DETECTORS) {
    this.detectors = detectors;
  }

  analyze(ctx: DetectorContext): AnalysisResult {
    const insights: Insight[] = [];
    const failures: string[] = [];
    for (const detector of this.detectors) {
      try {
        const found = detector.detect(ctx);
        for (const insight of found) insights.push(insight);
      } catch (e) {
        // Log locally for debugging; never expose stack traces or internals to the user.
        console.error(`[diary-server] detector "${detector.id}" failed:`, e);
        failures.push(t(ctx.locale, 'analysis.engine.detectorFailed', { label: detector.label(ctx.locale) }));
      }
    }
    const notes = [...ctx.notes, ...failures];
    return { insights, notes: notes.filter((n, i) => notes.indexOf(n) === i) };
  }
}

export const defaultProvider: AnalysisProvider = new RulesProvider();
