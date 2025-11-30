import React from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { submitIntakeRequest } from "@/lib/intake";
import { Calendar as CalendarIcon } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import {
    Popover,
    PopoverTrigger,
    PopoverContent,
} from "@/components/ui/popover";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { format } from "date-fns";

type IntakeFormState = {
    concern_type: string;
    urgency: "low" | "medium" | "high";
    preferred_date: string; // YYYY-MM-DD
    preferred_time: string; // e.g. "8:00 AM"
    details: string;
};

const DEFAULT_FORM: IntakeFormState = {
    concern_type: "",
    urgency: "medium",
    preferred_date: "",
    preferred_time: "",
    details: "",
};

type TimeOption = {
    value: string; // what we send to backend
    label: string; // what we show in the UI, with AM/PM
};

// 30-minute slots with AM/PM labels
const TIME_OPTIONS: TimeOption[] = [
    { value: "08:00 AM", label: "8:00 AM" },
    { value: "08:30 AM", label: "8:30 AM" },
    { value: "09:00 AM", label: "9:00 AM" },
    { value: "09:30 AM", label: "9:30 AM" },
    { value: "10:00 AM", label: "10:00 AM" },
    { value: "10:30 AM", label: "10:30 AM" },
    { value: "11:00 AM", label: "11:00 AM" },
    { value: "11:30 AM", label: "11:30 AM" },
    { value: "01:00 PM", label: "1:00 PM" },
    { value: "01:30 PM", label: "1:30 PM" },
    { value: "02:00 PM", label: "2:00 PM" },
    { value: "02:30 PM", label: "2:30 PM" },
    { value: "03:00 PM", label: "3:00 PM" },
    { value: "03:30 PM", label: "3:30 PM" },
    { value: "04:00 PM", label: "4:00 PM" },
    { value: "04:30 PM", label: "4:30 PM" },
];

const StudentIntake: React.FC = () => {
    const [form, setForm] = React.useState<IntakeFormState>(DEFAULT_FORM);
    const [isSubmitting, setIsSubmitting] = React.useState(false);
    const [preferredDate, setPreferredDate] = React.useState<Date | undefined>(
        undefined,
    );

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

        if (!form.preferred_date) {
            toast.error("Please select your preferred date.");
            return;
        }

        if (!form.preferred_time) {
            toast.error("Please select your preferred time.");
            return;
        }

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
            setPreferredDate(undefined);
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
                                <Label
                                    htmlFor="concern_type"
                                    className="text-xs font-medium text-amber-900"
                                >
                                    Main concern
                                </Label>
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
                                <Label
                                    htmlFor="urgency"
                                    className="text-xs font-medium text-amber-900"
                                >
                                    How urgent is this?
                                </Label>
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

                            {/* Preferred date & time (shadcn UI) */}
                            <div className="grid gap-4 sm:grid-cols-2">
                                {/* Date */}
                                <div className="space-y-1.5">
                                    <Label
                                        htmlFor="preferred_date"
                                        className="text-xs font-medium text-amber-900"
                                    >
                                        Preferred date
                                    </Label>
                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <Button
                                                type="button"
                                                variant="outline"
                                                className={`w-full justify-start text-left font-normal ${!preferredDate ? "text-muted-foreground" : ""
                                                    }`}
                                            >
                                                <CalendarIcon className="mr-2 h-4 w-4" />
                                                {preferredDate ? (
                                                    format(preferredDate, "PPP")
                                                ) : (
                                                    <span>Select date</span>
                                                )}
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0" align="start">
                                            <Calendar
                                                mode="single"
                                                selected={preferredDate}
                                                onSelect={(date) => {
                                                    setPreferredDate(date ?? undefined);
                                                    setForm((prev) => ({
                                                        ...prev,
                                                        preferred_date: date
                                                            ? format(date, "yyyy-MM-dd")
                                                            : "",
                                                    }));
                                                }}
                                                initialFocus
                                            />
                                        </PopoverContent>
                                    </Popover>
                                </div>

                                {/* Time (AM/PM) */}
                                <div className="space-y-1.5">
                                    <Label
                                        htmlFor="preferred_time"
                                        className="text-xs font-medium text-amber-900"
                                    >
                                        Preferred time
                                    </Label>
                                    <Select
                                        value={form.preferred_time}
                                        onValueChange={(value) =>
                                            setForm((prev) => ({
                                                ...prev,
                                                preferred_time: value,
                                            }))
                                        }
                                    >
                                        <SelectTrigger
                                            id="preferred_time"
                                            className="h-9 w-full text-left"
                                        >
                                            <SelectValue placeholder="Select time" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {TIME_OPTIONS.map((slot) => (
                                                <SelectItem key={slot.value} value={slot.value}>
                                                    {slot.label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            {/* Details */}
                            <div className="space-y-1.5">
                                <Label
                                    htmlFor="details"
                                    className="text-xs font-medium text-amber-900"
                                >
                                    Brief description of your concern
                                </Label>
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
