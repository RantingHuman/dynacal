export interface TestOnlyMarker {
  source: string;
  text: string;
}
export const TEST_ONLY_MARKERS: TestOnlyMarker[];
export function findTestOnlyMarkers(root: string): Promise<TestOnlyMarker[]>;
