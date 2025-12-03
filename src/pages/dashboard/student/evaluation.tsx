import React from "react";
import DashboardLayout from "@/components/DashboardLayout";
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { CalendarClock, Loader2, AlertCircle } from "lucide-react";
import { format, parseISO, startOfToday } from "date-fns";
import {
    fetchStudentAppointments,
    updateAppointmentDetails,
    type StudentAppointment,
} from "@/lib/appointments";
import {
    fetchStudentAssessments,
    type StudentAssessment,
} from "@/lib/intake";

function StatusBadge({ status }: { status: string }) {
    const normalized = status.toLowerCase();

    let label = status;
    let className =
        "border px-2 py-0.5 rounded-full text-[0.7rem] font-medium";

    switch (normalized) {
        case "pending":
            label = "Pending review";
            className += " bg-amber-50 text-amber-800 border-amber-200";
            break;
        case "in_review":
            label = "In review";
            className += " bg-sky-50 text-sky-800 border-sky-200";
            break;
        case "scheduled":
            label = "Scheduled";
            className += " bg-emerald-50 text-emerald-800 border-emerald-200";
            break;
        case "closed":
            label = "Closed";
            className += " bg-slate-50 text-slate-700 border-slate-200";
            break;
        default:
            label = status;
            className +=
                " bg-muted text-muted-foreground border-muted-foreground/20";
    }

    return <Badge className={className}>{label}</Badge>;
}

function formatPreferredDateTime(appointment: StudentAppointment): string {
    if (!appointment.preferred_date) {
        return "To be scheduled";
    }

    try {
        const date = parseISO(appointment.preferred_date);
        const dateText = format(date, "MMM d, yyyy");
        const timeText = appointment.preferred_time || "time to be confirmed";

        return `${dateText} · ${timeText}`;
    } catch {
        // Fallback to raw values if parsing fails
        return `${appointment.preferred_date}${
            appointment.preferred_time ? ` · ${appointment.preferred_time}` : ""
        }`;
    }
}

function formatDateDisplay(dateString?: string | null): string {
    if (!dateString) return "—";

    try {
        const date = parseISO(dateString);
        return format(date, "MMM d, yyyy");
    } catch {
        return dateString;
    }
}

function isUpcoming(appointment: StudentAppointment): boolean {
    if (!appointment.preferred_date) return false;

    try {
        const date = parseISO(appointment.preferred_date);
        const today = startOfToday();
        return date >= today;
    } catch {
        return false;
    }
}

/**
 * Only allow editing for pending / in_review requests.
 */
function canEditAppointment(appointment: StudentAppointment): boolean {
    const normalized = (appointment.status ?? "").toLowerCase();
    if (!normalized) return true;
    return normalized === "pending" || normalized === "in_review";
}

/**
 * Small helper component to show a short preview of the student's
 * concern details on each appointment card.
 */
function DetailsPreview({
    details,
}: {
    details?: string | null;
}) {
    if (!details) return null;

    const maxLength = 160;
    const text =
        details.length > maxLength
            ? details.slice(0, maxLength) + "…"
            : details;

    return (
        <p className="mt-1 text-[0.7rem] text-slate-600">
            <span className="font-medium">Details:</span> {text}
        </p>
    );
}

/**
 * Helper: format a short label for an assessment's basic snapshot.
 */
function formatAssessmentSummary(assessment: StudentAssessment): string {
    const bits: string[] = [];

    if (assessment.age != null) {
        bits.push(`Age: ${assessment.age}`);
    }

    if (assessment.gender) {
        bits.push(`Gender: ${assessment.gender}`);
    }

    if (assessment.occupation) {
        bits.push(`Occupation: ${assessment.occupation}`);
    }

    if (!bits.length) {
        return "Consent & questionnaire snapshot";
    }

    return bits.join(" • ");
}

const StudentEvaluation: React.FC = () => {
    const [appointments, setAppointments] = React.useState<StudentAppointment[]>(
        [],
    );
    const [assessments, setAssessments] = React.useState<StudentAssessment[]>(
        [],
    );
    const [isLoading, setIsLoading] = React.useState<boolean>(false);
    const [error, setError] = React.useState<string | null>(null);

    // inline edit state (details only)
    const [editingId, setEditingId] = React.useState<string | number | null>(
        null,
    );
    const [editingDetails, setEditingDetails] = React.useState<string>("");
    const [isSaving, setIsSaving] = React.useState<boolean>(false);

    const loadData = React.useCallback(async () => {
        setIsLoading(true);
        setError(null);

        try {
            const [appointmentsResponse, assessmentsResponse] =
                await Promise.all([
                    fetchStudentAppointments(),
                    fetchStudentAssessments(),
                ]);

            setAppointments(appointmentsResponse.appointments ?? []);
            setAssessments(assessmentsResponse.assessments ?? []);
        } catch (err) {
            const message =
                err instanceof Error
                    ? err.message
                    : "Failed to load your evaluation data.";
            setError(message);
            toast.error(message);
        } finally {
            setIsLoading(false);
        }
    }, []);

    React.useEffect(() => {
        void loadData();
    }, [loadData]);

    const upcomingAppointments = appointments.filter(isUpcoming);
    const pastAppointments = appointments.filter(
        (appointment) => !isUpcoming(appointment),
    );

    const handleEditClick = (appointment: StudentAppointment) => {
        if (!canEditAppointment(appointment)) return;

        // clicking again closes the editor
        if (editingId === appointment.id) {
            setEditingId(null);
            setEditingDetails("");
            return;
        }

        setEditingId(appointment.id as unknown as string | number);
        setEditingDetails(appointment.details ?? "");
    };

    const handleCancelEdit = () => {
        setEditingId(null);
        setEditingDetails("");
    };

    const handleSaveDetails = async (appointment: StudentAppointment) => {
        if (!editingDetails.trim()) {
            toast.error("Details cannot be empty.");
            return;
        }

        setIsSaving(true);
        try {
            const updated = await updateAppointmentDetails(
                appointment.id as unknown as string | number,
                {
                    details: editingDetails.trim(),
                },
            );

            setAppointments((prev) =>
                prev.map((a) => (a.id === updated.id ? updated : a)),
            );

            toast.success("Your details have been updated.");
            setEditingId(null);
            setEditingDetails("");
        } catch (err) {
            const message =
                err instanceof Error
                    ? err.message
                    : "Failed to update the details.";
            setError(message);
            toast.error(message);
        } finally {
            setIsSaving(false);
        }
    };

    const hasAnyData =
        appointments.length > 0 || assessments.length > 0;

    return (
        <DashboardLayout
            title="Evaluation"
            description="See your counseling requests (appointments) and mental health assessment history in one place."
        >
            <div className="flex w-full justify-center">
                <Card className="w-full max-w-4xl border-amber-100/80 bg-white/80 shadow-sm shadow-amber-100/60 backdrop-blur">
                    <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="space-y-1.5">
                            <CardTitle className="flex items-center gap-2 text-base font-semibold text-amber-900">
                                <CalendarClock className="h-4 w-4" />
                                <span>Evaluation – assessments & counseling history</span>
                            </CardTitle>
                            <p className="text-xs text-muted-foreground">
                                This page shows your submitted mental health assessments
                                (Steps 1–3) and your counseling requests with their current
                                status. You can correct details for pending requests.
                            </p>
                        </div>

                        <div className="flex justify-end sm:items-start">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => void loadData()}
                                disabled={isLoading}
                            >
                                {isLoading ? (
                                    <>
                                        <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                                        Refreshing…
                                    </>
                                ) : (
                                    "Refresh"
                                )}
                            </Button>
                        </div>
                    </CardHeader>

                    <CardContent className="space-y-6">
                        {isLoading && (
                            <div className="flex items-center justify-center py-10 text-xs text-muted-foreground">
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Loading your evaluation data…
                            </div>
                        )}

                        {!isLoading && error && (
                            <div className="flex items-start gap-2 rounded-md border border-red-100 bg-red-50/70 px-3 py-2 text-xs text-red-800">
                                <AlertCircle className="mt-px h-4 w-4 shrink-0" />
                                <div>
                                    <p className="font-medium">
                                        Unable to load evaluation data
                                    </p>
                                    <p className="mt-0.5">{error}</p>
                                </div>
                            </div>
                        )}

                        {!isLoading && !error && !hasAnyData && (
                            <div className="rounded-md border border-dashed border-amber-100 bg-amber-50/60 px-4 py-6 text-center text-xs text-amber-900">
                                You haven’t submitted any assessments or counseling requests yet.
                                <br />
                                <span className="mt-1 inline-block">
                                    Start by filling out the{" "}
                                    <span className="font-semibold">Intake</span> form in the
                                    sidebar.
                                </span>
                            </div>
                        )}

                        {!isLoading && !error && hasAnyData && (
                            <div className="space-y-6">
                                {/* Assessment history */}
                                <section className="space-y-2">
                                    <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between">
                                        <h2 className="text-xs font-semibold text-amber-900">
                                            Assessment history (Steps 1–3)
                                        </h2>
                                        <p className="text-[0.7rem] text-muted-foreground">
                                            These records come from the Mental Health Needs Assessment
                                            you submit on the Intake page.
                                        </p>
                                    </div>

                                    {assessments.length === 0 ? (
                                        <p className="text-[0.7rem] text-muted-foreground">
                                            You haven’t submitted any assessments yet.
                                        </p>
                                    ) : (
                                        <div className="space-y-2 text-xs">
                                            {assessments.map((assessment) => (
                                                <div
                                                    key={assessment.id}
                                                    className="flex flex-col gap-1 rounded-md border border-emerald-100 bg-emerald-50/50 px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
                                                >
                                                    <div className="space-y-0.5">
                                                        <p className="font-medium text-emerald-900">
                                                            Assessment submitted
                                                        </p>
                                                        <p className="text-[0.7rem] text-muted-foreground">
                                                            Submitted on{" "}
                                                            <span className="font-medium">
                                                                {formatDateDisplay(
                                                                    assessment.created_at,
                                                                )}
                                                            </span>
                                                        </p>
                                                        <p className="text-[0.7rem] text-slate-700">
                                                            {formatAssessmentSummary(assessment)}
                                                        </p>
                                                    </div>
                                                    <div className="mt-1 flex flex-col items-start gap-1 text-[0.7rem] text-muted-foreground sm:mt-0 sm:items-end">
                                                        <p>
                                                            Consent given:{" "}
                                                            <span className="font-medium">
                                                                {assessment.consent
                                                                    ? "Yes"
                                                                    : "No"}
                                                            </span>
                                                        </p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </section>

                                {/* Counseling requests & sessions */}
                                <section className="space-y-5">
                                    {/* Upcoming */}
                                    <section className="space-y-2">
                                        <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between">
                                            <h2 className="text-xs font-semibold text-amber-900">
                                                Upcoming / active requests
                                            </h2>
                                            <p className="text-[0.7rem] text-muted-foreground">
                                                These are counseling requests with a preferred date
                                                today or later.
                                            </p>
                                        </div>

                                        {upcomingAppointments.length === 0 ? (
                                            <p className="text-[0.7rem] text-muted-foreground">
                                                No upcoming appointments yet. Once a counselor
                                                schedules a session, it will appear here.
                                            </p>
                                        ) : (
                                            <div className="space-y-2 text-xs">
                                                {upcomingAppointments.map((appointment) => (
                                                    <div
                                                        key={appointment.id}
                                                        className="flex flex-col gap-1 rounded-md border border-amber-100 bg-amber-50/50 px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
                                                    >
                                                        <div className="space-y-0.5">
                                                            <div className="flex flex-col gap-1.5 sm:flex-row sm:flex-wrap sm:items-center sm:gap-2">
                                                                <p className="font-medium text-amber-900">
                                                                    {appointment.concern_type ||
                                                                        "Counseling request"}
                                                                </p>
                                                                <StatusBadge
                                                                    status={
                                                                        appointment.status ??
                                                                        "pending"
                                                                    }
                                                                />
                                                                {canEditAppointment(
                                                                    appointment,
                                                                ) && (
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="sm"
                                                                        className="h-6 px-2 text-[0.65rem]"
                                                                        type="button"
                                                                        onClick={() =>
                                                                            handleEditClick(
                                                                                appointment,
                                                                            )
                                                                        }
                                                                        disabled={
                                                                            isSaving &&
                                                                            editingId ===
                                                                                appointment.id
                                                                        }
                                                                    >
                                                                        {editingId ===
                                                                        appointment.id
                                                                            ? "Close editor"
                                                                            : "Edit details"}
                                                                    </Button>
                                                                )}
                                                            </div>
                                                            <p className="text-[0.7rem] text-muted-foreground">
                                                                {formatPreferredDateTime(
                                                                    appointment,
                                                                )}
                                                            </p>

                                                            {editingId ===
                                                            appointment.id ? (
                                                                <div className="mt-1 space-y-1">
                                                                    <textarea
                                                                        className="w-full rounded border border-amber-200 bg-white px-2 py-1 text-[0.7rem] text-slate-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-amber-500/60"
                                                                        rows={3}
                                                                        value={editingDetails}
                                                                        onChange={(e) =>
                                                                            setEditingDetails(
                                                                                e.target.value,
                                                                            )
                                                                        }
                                                                        disabled={isSaving}
                                                                    />
                                                                    <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                                                                        <Button
                                                                            variant="outline"
                                                                            size="sm"
                                                                            className="h-7 px-2 text-[0.7rem]"
                                                                            type="button"
                                                                            onClick={
                                                                                handleCancelEdit
                                                                            }
                                                                            disabled={isSaving}
                                                                        >
                                                                            Cancel
                                                                        </Button>
                                                                        <Button
                                                                            size="sm"
                                                                            className="h-7 px-3 text-[0.7rem]"
                                                                            type="button"
                                                                            onClick={() =>
                                                                                void handleSaveDetails(
                                                                                    appointment,
                                                                                )
                                                                            }
                                                                            disabled={
                                                                                isSaving ||
                                                                                !editingDetails
                                                                                    .trim()
                                                                                    .length
                                                                            }
                                                                        >
                                                                            {isSaving &&
                                                                            editingId ===
                                                                                appointment.id ? (
                                                                                <>
                                                                                    <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                                                                                    Saving…
                                                                                </>
                                                                            ) : (
                                                                                "Save changes"
                                                                            )}
                                                                        </Button>
                                                                    </div>
                                                                </div>
                                                            ) : (
                                                                <DetailsPreview
                                                                    details={
                                                                        appointment.details
                                                                    }
                                                                />
                                                            )}
                                                        </div>

                                                        <div className="mt-1 flex flex-col items-start gap-1 text-[0.7rem] text-muted-foreground sm:mt-0 sm:items-end">
                                                            <p>
                                                                Urgency:{" "}
                                                                <span className="font-medium capitalize">
                                                                    {appointment.urgency ??
                                                                        "medium"}
                                                                </span>
                                                            </p>
                                                            <p>
                                                                Requested on:{" "}
                                                                <span className="font-medium">
                                                                    {formatDateDisplay(
                                                                        appointment.created_at,
                                                                    )}
                                                                </span>
                                                            </p>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </section>

                                    {/* History / past */}
                                    <section className="space-y-2">
                                        <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between">
                                            <h2 className="text-xs font-semibold text-amber-900">
                                                Past requests
                                            </h2>
                                            <p className="text-[0.7rem] text-muted-foreground">
                                                Older requests and sessions are kept here for your
                                                reference.
                                            </p>
                                        </div>

                                        {pastAppointments.length === 0 ? (
                                            <p className="text-[0.7rem] text-muted-foreground">
                                                You don’t have any past requests yet.
                                            </p>
                                        ) : (
                                            <div className="space-y-2 text-xs">
                                                {pastAppointments.map((appointment) => (
                                                    <div
                                                        key={appointment.id}
                                                        className="flex flex-col gap-1 rounded-md border border-slate-100 bg-slate-50/60 px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
                                                    >
                                                        <div className="space-y-0.5">
                                                            <div className="flex flex-col gap-1.5 sm:flex-row sm:flex-wrap sm:items-center sm:gap-2">
                                                                <p className="font-medium text-slate-900">
                                                                    {appointment.concern_type ||
                                                                        "Counseling request"}
                                                                </p>
                                                                <StatusBadge
                                                                    status={
                                                                        appointment.status ??
                                                                        "pending"
                                                                    }
                                                                />
                                                                {canEditAppointment(
                                                                    appointment,
                                                                ) && (
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="sm"
                                                                        className="h-6 px-2 text-[0.65rem]"
                                                                        type="button"
                                                                        onClick={() =>
                                                                            handleEditClick(
                                                                                appointment,
                                                                            )
                                                                        }
                                                                        disabled={
                                                                            isSaving &&
                                                                            editingId ===
                                                                                appointment.id
                                                                        }
                                                                    >
                                                                        {editingId ===
                                                                        appointment.id
                                                                            ? "Close editor"
                                                                            : "Edit details"}
                                                                    </Button>
                                                                )}
                                                            </div>
                                                            <p className="text-[0.7rem] text-muted-foreground">
                                                                {formatPreferredDateTime(
                                                                    appointment,
                                                                )}
                                                            </p>

                                                            {editingId ===
                                                            appointment.id ? (
                                                                <div className="mt-1 space-y-1">
                                                                    <textarea
                                                                        className="w-full rounded border border-slate-200 bg-white px-2 py-1 text-[0.7rem] text-slate-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-400/60"
                                                                        rows={3}
                                                                        value={editingDetails}
                                                                        onChange={(e) =>
                                                                            setEditingDetails(
                                                                                e.target.value,
                                                                            )
                                                                        }
                                                                        disabled={isSaving}
                                                                    />
                                                                    <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                                                                        <Button
                                                                            variant="outline"
                                                                            size="sm"
                                                                            className="h-7 px-2 text-[0.7rem]"
                                                                            type="button"
                                                                            onClick={
                                                                                handleCancelEdit
                                                                            }
                                                                            disabled={isSaving}
                                                                        >
                                                                            Cancel
                                                                        </Button>
                                                                        <Button
                                                                            size="sm"
                                                                            className="h-7 px-3 text-[0.7rem]"
                                                                            type="button"
                                                                            onClick={() =>
                                                                                void handleSaveDetails(
                                                                                    appointment,
                                                                                )
                                                                            }
                                                                            disabled={
                                                                                isSaving ||
                                                                                !editingDetails
                                                                                    .trim()
                                                                                    .length
                                                                            }
                                                                        >
                                                                            {isSaving &&
                                                                            editingId ===
                                                                                appointment.id ? (
                                                                                <>
                                                                                    <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                                                                                    Saving…
                                                                                </>
                                                                            ) : (
                                                                                "Save changes"
                                                                            )}
                                                                        </Button>
                                                                    </div>
                                                                </div>
                                                            ) : (
                                                                <DetailsPreview
                                                                    details={
                                                                        appointment.details
                                                                    }
                                                                />
                                                            )}
                                                        </div>

                                                        <div className="mt-1 flex flex-col items-start gap-1 text-[0.7rem] text-muted-foreground sm:mt-0 sm:items-end">
                                                            <p>
                                                                Urgency:{" "}
                                                                <span className="font-medium capitalize">
                                                                    {appointment.urgency ??
                                                                        "medium"}
                                                                </span>
                                                            </p>
                                                            <p>
                                                                Requested on:{" "}
                                                                <span className="font-medium">
                                                                    {formatDateDisplay(
                                                                        appointment.created_at,
                                                                    )}
                                                                </span>
                                                            </p>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </section>
                                </section>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </DashboardLayout>
    );
};

export default StudentEvaluation;
