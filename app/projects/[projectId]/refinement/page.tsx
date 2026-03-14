import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { NotFoundError, getWorkspaceContext } from "@/src/lib/intake/service";
import {
  NotFoundError as RefinementNotFoundError,
  refinementApplicationModule,
} from "@/src/lib/refinement/application-module";
import { CANONICAL_ARTIFACT_SEQUENCE } from "@/src/lib/refinement/model";
import type { ArtifactKey } from "@/src/lib/refinement/types";
import { LOCALE_COOKIE, getDictionary, resolveLocale } from "@/src/lib/i18n";
import { RefinementWorkbench } from "@/src/components/refinement-workbench";

interface RefinementPageProps {
  params: Promise<{
    projectId: string;
  }>;
  searchParams: Promise<{
    artifactKey?: string;
    feedbackTaskId?: string;
    feedbackArtifactSnapshotId?: string;
    feedbackNote?: string;
  }>;
}

export default async function RefinementWorkspacePage(props: RefinementPageProps) {
  const { projectId } = await props.params;
  const searchParams = await props.searchParams;
  const locale = resolveLocale((await cookies()).get(LOCALE_COOKIE)?.value);
  const dict = getDictionary(locale);

  try {
    const intakeContext = await getWorkspaceContext(projectId);

    if (intakeContext.project.lifecycleStatus !== "confirmed") {
      return (
        <main className="shell">
          <section className="hero">
            <span className="eyebrow">{dict.refinement.screenId}</span>
            <h1>{dict.refinement.intakeNotConfirmed}</h1>
            <p>{dict.refinement.intakeNotConfirmedBody}</p>
          </section>
        </main>
      );
    }

    const refinementContext =
      await refinementApplicationModule.getProjectWorkspaceContext(projectId);

    const activeKeyParam = searchParams.artifactKey;
    const activeKey: ArtifactKey =
      activeKeyParam && CANONICAL_ARTIFACT_SEQUENCE.includes(activeKeyParam as ArtifactKey)
        ? (activeKeyParam as ArtifactKey)
        : refinementContext.refinementSession?.activeArtifactKey ?? "objective_and_outcome";

    const activeSummary = refinementContext.artifactSummaries.find(
      (summary) => summary.artifactKey === activeKey,
    );

    const currentSnapshotId = activeSummary?.currentSnapshotId ?? null;
    const reviewContext = currentSnapshotId
      ? await refinementApplicationModule
          .getArtifactApprovalReviewContext(projectId, activeKey, currentSnapshotId)
          .catch(() => null)
      : null;

    return (
      <RefinementWorkbench
        locale={locale}
        dictionary={dict}
        projectId={projectId}
        projectTitle={intakeContext.project.title}
        planningMode={intakeContext.project.planningMode}
        sessionId={refinementContext.refinementSession?.refinementSessionId ?? null}
        activeKey={activeKey}
        artifactSummaries={refinementContext.artifactSummaries}
        reviewContext={reviewContext}
        feedbackContext={{
          taskId: searchParams.feedbackTaskId ?? null,
          artifactSnapshotId: searchParams.feedbackArtifactSnapshotId ?? null,
          feedbackNote: searchParams.feedbackNote ?? null,
        }}
      />
    );
  } catch (error) {
    if (error instanceof NotFoundError || error instanceof RefinementNotFoundError) {
      notFound();
    }
    throw error;
  }
}
