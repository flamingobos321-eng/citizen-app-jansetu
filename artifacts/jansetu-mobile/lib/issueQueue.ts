type SearchableIssue = {
  issue_code: string;
  title: string;
  status: string;
};

const normalize = (value: string) => value.normalize('NFKC').trim().toLowerCase();

/** Filter only the authorized issues supplied by the API; never fetch a wider queue. */
export function filterOfficeIssues<T extends SearchableIssue>(
  issues: readonly T[],
  search: string,
  status: string | null,
): T[] {
  const words = normalize(search).split(/\s+/).filter(Boolean);
  return issues.filter((issue) => {
    if (status !== null && issue.status !== status) return false;
    const text = normalize(`${issue.issue_code} ${issue.title}`);
    return words.every((word) => text.includes(word));
  });
}

export function getOfficeIssueStatuses(issues: readonly SearchableIssue[]): string[] {
  return [...new Set(issues.map((issue) => issue.status).filter(Boolean))]
    .sort((left, right) => left.localeCompare(right));
}
