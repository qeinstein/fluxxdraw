interface RankableLibrary {
  name: string;
  description?: string | null;
}

const TIERS: [number, string[]][] = [
  [120, ["system design", "software architecture", "solution architecture", "architecture diagram", "distributed system"]],
  [90, ["microservice", "event driven", "data flow", "sequence diagram", "deployment diagram", "c4 model", "uml"]],
  [65, ["aws", "amazon web services", "gcp", "google cloud", "azure", "kubernetes", "docker", "terraform", "cloud", "infrastructure", "devops"]],
  [40, ["database", "server", "network", "api", "queue", "cache", "observability", "platform", "software", "flowchart"]],
];

export const libraryPriorityScore = ({ name, description }: RankableLibrary) => {
  const normalizedName = name.toLowerCase();
  const normalizedDescription = (description ?? "").toLowerCase();
  let score = 0;
  for (const [weight, keywords] of TIERS) {
    score += keywords.filter((keyword) => normalizedName.includes(keyword)).length * weight * 3;
    score += keywords.filter((keyword) => normalizedDescription.includes(keyword)).length * weight;
  }
  return score;
};

export const isArchitectureLibrary = (library: RankableLibrary) =>
  libraryPriorityScore(library) >= 90;

export const rankLibraries = <T extends RankableLibrary>(libraries: T[]) =>
  [...libraries].sort((left, right) => {
    const scoreDifference = libraryPriorityScore(right) - libraryPriorityScore(left);
    return scoreDifference || left.name.localeCompare(right.name);
  });
