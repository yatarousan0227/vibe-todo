import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { NotFoundError, getWorkspaceContext } from "@/src/lib/intake/service";
import {
  NotFoundError as RefinementNotFoundError,
  refinementApplicationModule,
} from "@/src/lib/refinement/application-module";
import { planningApplicationModule } from "@/src/lib/planning/application-module";
import { LOCALE_COOKIE, getDictionary, resolveLocale } from "@/src/lib/i18n";
import { TaskSynthesisScreen } from "@/src/components/task-synthesis-screen";

interface TaskSynthesisPageProps {
  params: Promise<{ projectId: string }>;
}

export default async function TaskSynthesisPage({ params }: TaskSynthesisPageProps) {
  const { projectId } = await params;
  const locale = resolveLocale((await cookies()).get(LOCALE_COOKIE)?.value);
  const dict = getDictionary(locale);

  try {
    const intakeContext = await getWorkspaceContext(projectId);

    if (intakeContext.project.lifecycleStatus !== "confirmed") {
      return (
        <main className="shell">
          <section className="hero">
            <span className="eyebrow">{dict.taskSynthesis.screenId}</span>
            <h1>{dict.refinement.intakeNotConfirmed}</h1>
            <p>{dict.refinement.intakeNotConfirmedBody}</p>
          </section>
        </main>
      );
    }

    try {
      const refinementContext =
        await refinementApplicationModule.getProjectWorkspaceContext(projectId);

      const currentApprovedSnapshotIds = refinementContext.artifactSummaries
        .filter((summary) => summary.displayStatus === "approved" && summary.currentSnapshotId)
        .map((summary) => summary.currentSnapshotId as string);

      await planningApplicationModule.markTaskPlanStaleIfNeeded(
        projectId,
        currentApprovedSnapshotIds,
      );

      const taskPlanSummary = await planningApplicationModule.getTaskPlanSummary(
        projectId,
        refinementContext.artifactSummaries,
      );

      const taskPlanSummaryData = {
        eligibility: taskPlanSummary.eligibility,
        jobStatus: taskPlanSummary.jobStatus,
        workspaceHandoffState: taskPlanSummary.workspaceHandoffState,
        latestSnapshot: taskPlanSummary.latestSnapshot
          ? {
              taskPlanSnapshotId: taskPlanSummary.latestSnapshot.task_plan_snapshot_id,
              freshnessStatus: taskPlanSummary.latestSnapshot.freshness_status,
              publishStatus: taskPlanSummary.latestSnapshot.publish_status,
              generatedAt: taskPlanSummary.latestSnapshot.generated_at,
              publishBlockerCount:
                taskPlanSummary.latestSnapshot.publish_blockers.length,
            }
          : null,
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
                      (snapshotId) => !currentApprovedSnapshotIds.includes(snapshotId),
                    )
                  : [],
            }
          : null,
      };

      return (
        <main>
            <TaskSynthesisScreen
            locale={locale}
            dictionary={dict}
            projectId={projectId}
            artifactSummaries={refinementContext.artifactSummaries}
            taskPlanSummaryData={taskPlanSummaryData}
          />
        </main>
      );
    } catch (refinementError) {
      if (refinementError instanceof RefinementNotFoundError) {
        return (
          <main className="shell">
            <section className="hero">
              <span className="eyebrow">{dict.taskSynthesis.screenId}</span>
              <h1>{dict.refinement.taskSynthesisLocked}</h1>
              <p>{dict.refinement.taskSynthesisLockedBody}</p>
            </section>
          </main>
        );
      }

      throw refinementError;
    }
  } catch (error) {
    if (error instanceof NotFoundError) {
      notFound();
    }
    throw error;
  }
}
