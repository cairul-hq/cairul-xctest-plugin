import { join } from 'node:path';
import { z } from '@cairul/plugin-kit';
import { counts, list, option, selectors, value, executeRunner } from '@cairul/plugin-kit/runner';

const nonnegative = z.number().int().nonnegative();
const summary = z.object({
  passedTests: nonnegative,
  failedTests: nonnegative,
  skippedTests: nonnegative,
  expectedFailures: nonnegative.default(0),
});

export default {
  command: ['xcodebuild'],
  settings: {
    scheme: z.string().min(1).optional(),
    workspace: value,
    project: value,
    destination: value,
    testPlan: value,
  },
  select: selectors({ targets: list, classes: list, methods: list }),
  build({ targets, classes, methods }, temp, settings) {
    if (!settings.scheme) throw new Error('Set plugin options.scheme for XCTest execution.');
    if (settings.workspace && settings.project) throw new Error('Choose Xcode workspace or project.');
    if (classes?.some((name) => name.split('/').length !== 2) || methods?.some((name) => name.split('/').length !== 3))
      throw new Error('Use Target/Class or Target/Class/Method identifiers.');
    const result = join(temp, 'result.xcresult');
    return {
      args: [
        'test',
        '-scheme',
        settings.scheme,
        ...option('-workspace', settings.workspace),
        ...option('-project', settings.project),
        ...option('-destination', settings.destination),
        ...option('-testPlan', settings.testPlan),
        ...[...(targets ?? []), ...(classes ?? []), ...(methods ?? [])].map((item) => '-only-testing:' + item),
        '-resultBundlePath',
        result,
      ],
      read: async (_temp, _stdout, signal) => {
        const data = await executeRunner(
          'xcrun',
          ['xcresulttool', 'get', 'test-results', 'summary', '--path', result],
          temp,
          signal
        );
        const parsed = summary.parse(JSON.parse(data));
        return counts(parsed.passedTests, parsed.failedTests, parsed.skippedTests + parsed.expectedFailures);
      },
    };
  },
};
