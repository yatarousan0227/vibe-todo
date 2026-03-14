import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { NotFoundError, getWorkspaceContext } from "@/src/lib/intake/service";
import {
  NotFoundError as RefinementNotFoundError,
  refinementApplicationModule,
} from "@/src/lib/refinement/application-module";
import { planningApplicationModule } from "@/src/lib/planning/application-module";
import { LOCALE_COOKIE, getDictionary, resolveLocale } from "@/src/lib/i18n";
import { ManagementWorkspace } from "@/src/components/management-workspace";

interface WorkspacePageProps {
  params: Promise<{ projectId: string }>;
}

export default async function WorkspacePage({ params }: WorkspacePageProps) {
  const { projectId } = await params;
  const locale = resolveLocale((await cookies()).get(LOCALE_COOKIE)?.value);
  const dict = getDictionary(locale);

  try {
    const intakeContext = await getWorkspaceContext(projectId);

    if (intakeContext.project.lifecycleStatus !== "confirmed") {
      return (
        <main className="shell">
          <section className="hero">
            <span className="eyebrow">{dict.workspace.screenId}</span>
            <h1>{dict.refinement.intakeNotConfirmed}</h1>
            <p>{dict.refinement.intakeNotConfirmedBody}</p>
          </section>
        </main>
      );
    }

    let taskPlanSummaryData = null;

    try {
      const refinementContext =
        await refinementApplicationModule.getProjectWorkspaceContext(projectId);

      const currentApprovedSnapshotIds = refinementContext.artifactSummaries
        .filter((s) => s.displayStatus === "approved" && s.currentSnapshotId)
        .map((s) => s.currentSnapshotId as string);

      await planningApplicationModule.markTaskPlanStaleIfNeeded(
        projectId,
        currentApprovedSnapshotIds,
      );

      const taskPlanSummary = await planningApplicationModule.getTaskPlanSummary(
        projectId,
        refinementContext.artifactSummaries,
      );

      taskPlanSummaryData = {
        workspaceHandoffState: taskPlanSummary.workspaceHandoffState,
        currentPublishedSnapshot: taskPlanSummary.currentPublishedSnapshot
          ? {
              taskPlanSnapshotId:
                taskPlanSummary.currentPublishedSnapshot.task_plan_snapshot_id,
              freshnessStatus:
                taskPlanSummary.currentPublishedSnapshot.freshness_status,
              generatedAt: taskPlanSummary.currentPublishedSnapshot.generated_at,
              publishedAt: taskPlanSummary.currentPublishedSnapshot.published_at,
              generatedFromArtifactSet:
                taskPlanSummary.currentPublishedSnapshot.generated_from_artifact_set,
            }
          : null,
        staleDependencies: taskPlanSummary.currentPublishedSnapshot
          ? {
              affectedSourceSnapshotIds:
                taskPlanSummary.currentPublishedSnapshot.freshness_status === "stale"
                  ? taskPlanSummary.currentPublishedSnapshot.generated_from_artifact_set.filter(
                      (id) => !currentApprovedSnapshotIds.includes(id),
                    )
                  : [],
            }
          : null,
      };
    } catch (refinementError) {
      if (!(refinementError instanceof RefinementNotFoundError)) {
        throw refinementError;
      }
      // No refinement session yet — workspace has no published plan
    }

    return (
      <main>
        <ManagementWorkspace
          locale={locale}
          dictionary={dict}
          projectId={projectId}
          projectTitle={intakeContext.project.title}
          taskPlanSummaryData={taskPlanSummaryData}
        />
      </main>
    );
  } catch (error) {
    if (error instanceof NotFoundError) {
      notFound();
    }
    throw error;
  }
}
