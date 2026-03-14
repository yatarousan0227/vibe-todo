import { STATUS_LABELS, getArtifactLabel, type Locale } from "@/src/lib/i18n";
import type { ArtifactKey, ArtifactSummary } from "@/src/lib/refinement/types";

function StatusPill({ locale, status }: { locale: Locale; status: string }) {
  const colorMap: Record<string, string> = {
    approved: "status-approved",
    ready: "status-ready",
    draft: "status-draft",
    stale: "status-stale",
    blocked: "status-blocked",
  };
  return (
    <span className={`statusPill ${colorMap[status] ?? ""}`}>
      {STATUS_LABELS[locale][status as keyof typeof STATUS_LABELS.en] ?? status}
    </span>
  );
}

export function RefinementArtifactRail(props: {
  summaries: ArtifactSummary[];
  activeKey: ArtifactKey;
  projectId: string;
  locale: Locale;
}) {
  const { summaries, activeKey, projectId, locale } = props;

  return (
    <nav aria-label="Artifact sequence" className="artifactRail">
      {summaries.map((summary) => {
        const isActive = summary.artifactKey === activeKey;
        const isBlocked = summary.displayStatus === "blocked";
        return (
          <div
            key={summary.artifactKey}
            className={`railItem ${isActive ? "railItem--active" : ""} ${isBlocked ? "railItem--blocked" : ""}`}
            data-testid={`rail-item-${summary.artifactKey}`}
          >
            <div className="railItemLabel">
              <a
                href={`/projects/${projectId}/refinement?artifactKey=${summary.artifactKey}`}
                className="railLink"
              >
                {getArtifactLabel(locale, summary.artifactKey)}
              </a>
            </div>
            <StatusPill locale={locale} status={summary.displayStatus} />
            {summary.versionNumber !== null && (
              <span className="versionBadge">v{summary.versionNumber}</span>
            )}
          </div>
        );
      })}
    </nav>
  );
}
