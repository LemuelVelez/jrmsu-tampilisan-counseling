import React from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { submitIntakeRequest } from "@/lib/intake";

type IntakeFormState = {
    concern_type: string;
    urgency: "low" | "medium" | "high";
    preferred_date: string;
    preferred_time: string;
    details: string;
};

const DEFAULT_FORM: IntakeFormState = {
    concern_type: "",
    urgency: "medium",
    preferred_date: "",
    preferred_time: "",
    details: "",
};

const StudentIntake: React.FC = () => {
    const [form, setForm] = React.useState<IntakeFormState>(DEFAULT_FORM);
    const [isSubmitting, setIsSubmitting] = React.useState(false);

    const handleChange = (
        event: React.ChangeEvent<
            HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
        >,
    ) => {
        const { name, value } = event.target;
        setForm((prev) => ({
            ...prev,
            [name]: value,
        }));
    };

    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setIsSubmitting(true);

        try {
            const payload = {
                concern_type: form.concern_type,
                urgency: form.urgency,
                preferred_date: form.preferred_date,
                preferred_time: form.preferred_time,
                details: form.details.trim(),
            };

            const response = await submitIntakeRequest(payload);

            const successMessage =
                response?.message || "Your counseling request has been submitted.";

            toast.success(successMessage);
            setForm(DEFAULT_FORM);
        } catch (error) {
            const message =
                error instanceof Error
                    ? error.message
                    : "Failed to submit your counseling request.";
            toast.error(message);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <DashboardLayout
            title="Intake"
            description="Submit a counseling request to the Guidance & Counseling Office."
        >
            <div className="flex w-full justify-center">
                <Card className="w-full max-w-3xl border-amber-100/80 bg-white/80 shadow-sm shadow-amber-100/60 backdrop-blur">
                    <CardHeader className="space-y-2 text-center">
                        <CardTitle className="text-base font-semibold text-amber-900">
                            Counseling request form
                        </CardTitle>
                        <p className="text-xs text-muted-foreground">
                            Fill out this short form to let the guidance team know what you’re
                            experiencing and when you’re available. Your request will be
                            reviewed by a counselor.
                        </p>
                    </CardHeader>

                    <CardContent>
                        <form className="space-y-4" onSubmit={handleSubmit}>
                            {/* Concern type */}
                            <div className="space-y-1.5">
                                <label
                                    htmlFor="concern_type"
                                    className="text-xs font-medium text-amber-900"
                                >
                                    Main concern
                                </label>
                                <select
                                    id="concern_type"
                                    name="concern_type"
                                    value={form.concern_type}
                                    onChange={handleChange}
                                    required
                                    className="h-9 w-full rounded-md border border-amber-100 bg-white/90 px-3 text-sm shadow-inner shadow-amber-50/70 outline-none ring-0 transition focus-visible:border-amber-300 focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-1 focus-visible:ring-offset-amber-50"
                                >
                                    <option value="">Select a concern...</option>
                                    <option value="academic">Academic</option>
                                    <option value="personal">Personal / emotional</option>
                                    <option value="family">Family</option>
                                    <option value="mental_health">Mental health</option>
                                    <option value="career">Career / future</option>
                                    <option value="other">Other</option>
                                </select>
                            </div>

                            {/* Urgency */}
                            <div className="space-y-1.5">
                                <label
                                    htmlFor="urgency"
                                    className="text-xs font-medium text-amber-900"
                                >
                                    How urgent is this?
                                </label>
                                <select
                                    id="urgency"
                                    name="urgency"
                                    value={form.urgency}
                                    onChange={handleChange}
                                    className="h-9 w-full rounded-md border border-amber-100 bg-white/90 px-3 text-sm shadow-inner shadow-amber-50/70 outline-none ring-0 transition focus-visible:border-amber-300 focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-1 focus-visible:ring-offset-amber-50"
                                    required
                                >
                                    <option value="low">Not urgent</option>
                                    <option value="medium">Soon (within 1–2 weeks)</option>
                                    <option value="high">Urgent (as soon as possible)</option>
                                </select>
                                <p className="text-[0.7rem] text-muted-foreground">
                                    If you are in immediate danger, please contact emergency
                                    services or campus security right away.
                                </p>
                            </div>

                            {/* Preferred date & time */}
                            <div className="grid gap-4 sm:grid-cols-2">
                                <div className="space-y-1.5">
                                    <label
                                        htmlFor="preferred_date"
                                        className="text-xs font-medium text-amber-900"
                                    >
                                        Preferred date
                                    </label>
                                    <Input
                                        id="preferred_date"
                                        name="preferred_date"
                                        type="date"
                                        value={form.preferred_date}
                                        onChange={handleChange}
                                        required
                                        className="h-9"
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <label
                                        htmlFor="preferred_time"
                                        className="text-xs font-medium text-amber-900"
                                    >
                                        Preferred time
                                    </label>
                                    <Input
                                        id="preferred_time"
                                        name="preferred_time"
                                        type="time"
                                        value={form.preferred_time}
                                        onChange={handleChange}
                                        required
                                        className="h-9"
                                    />
                                </div>
                            </div>

                            {/* Details */}
                            <div className="space-y-1.5">
                                <label
                                    htmlFor="details"
                                    className="text-xs font-medium text-amber-900"
                                >
                                    Brief description of your concern
                                </label>
                                <textarea
                                    id="details"
                                    name="details"
                                    required
                                    rows={5}
                                    value={form.details}
                                    onChange={handleChange}
                                    placeholder="Share what you’re going through, how long it has been happening, and anything else you want your counselor to know."
                                    className="w-full rounded-md border border-amber-100 bg-white/90 px-3 py-2 text-sm shadow-inner shadow-amber-50/70 outline-none ring-0 transition focus-visible:border-amber-300 focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-1 focus-visible:ring-offset-amber-50"
                                />
                                <p className="text-[0.7rem] text-muted-foreground">
                                    You can use English, Filipino, or Bisaya — whatever you’re
                                    most comfortable with.
                                </p>
                            </div>

                            <div className="flex flex-col gap-2 pt-2 sm:flex-row sm:items-center sm:justify-between">
                                <Button
                                    type="submit"
                                    className="w-full sm:w-auto"
                                    disabled={isSubmitting}
                                >
                                    {isSubmitting ? "Submitting..." : "Submit request"}
                                </Button>

                                <p className="text-[0.7rem] text-muted-foreground sm:text-right">
                                    Your request will be linked to your JRMSU account and kept
                                    private within the Guidance &amp; Counseling Office.
                                </p>
                            </div>
                        </form>
                    </CardContent>
                </Card>
            </div>
        </DashboardLayout>
    );
};

export default StudentIntake;
