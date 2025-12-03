/* eslint-disable @typescript-eslint/no-explicit-any */
import React from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { submitIntakeRequest, submitIntakeAssessment } from "@/lib/intake";
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
import { getCurrentSession } from "@/lib/authentication";

type MentalFrequency =
    | "not_at_all"
    | "several_days"
    | "more_than_half"
    | "nearly_every_day";

type IntakeFormState = {
    // Step 1 – Consent
    consent: boolean;

    // Step 2 – Demographic info (self-reported for this request)
    student_name: string;
    age: string;
    gender: "" | "male" | "female" | "non_binary_other";
    occupation: string;
    living_situation: "" | "alone" | "with_family" | "with_friends" | "other";
    living_situation_other: string;

    // Step 3 – General mental health status (past two weeks)
    mh_little_interest: MentalFrequency | "";
    mh_feeling_down: MentalFrequency | "";
    mh_sleep: MentalFrequency | "";
    mh_energy: MentalFrequency | "";
    mh_appetite: MentalFrequency | "";
    mh_self_esteem: MentalFrequency | "";
    mh_concentration: MentalFrequency | "";
    mh_motor: MentalFrequency | "";
    mh_self_harm: MentalFrequency | "";

    // Step 4 – Scheduling & main concern
    concern_type: string;
    urgency: "low" | "medium" | "high";
    preferred_date: string; // YYYY-MM-DD
    preferred_time: string; // e.g. "8:00 AM"
    additional_details: string;
};

const DEFAULT_FORM: IntakeFormState = {
    consent: false,
    student_name: "",
    age: "",
    gender: "",
    occupation: "",
    living_situation: "",
    living_situation_other: "",
    mh_little_interest: "",
    mh_feeling_down: "",
    mh_sleep: "",
    mh_energy: "",
    mh_appetite: "",
    mh_self_esteem: "",
    mh_concentration: "",
    mh_motor: "",
    mh_self_harm: "",
    concern_type: "",
    urgency: "medium",
    preferred_date: "",
    preferred_time: "",
    additional_details: "",
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

const normaliseGenderFromSession = (
    rawGender: unknown,
): IntakeFormState["gender"] => {
    if (typeof rawGender !== "string") return "";
    const g = rawGender.trim().toLowerCase();
    if (!g) return "";
    if (g.startsWith("m")) return "male"; // male / man
    if (g.startsWith("f")) return "female"; // female / woman
    // Any other stored value → treat as non-binary/other
    return "non_binary_other";
};

const buildInitialFormFromSession = (): IntakeFormState => {
    const base: IntakeFormState = { ...DEFAULT_FORM };
    const session = getCurrentSession();
    const user: any = session.user ?? {};

    if (user.name) {
        base.student_name = String(user.name);
    }

    base.gender = normaliseGenderFromSession(user.gender);

    return base;
};

const StudentIntake: React.FC = () => {
    const [form, setForm] = React.useState<IntakeFormState>(() =>
        buildInitialFormFromSession(),
    );

    const [isSubmittingAssessment, setIsSubmittingAssessment] =
        React.useState(false);
    const [isSubmittingRequest, setIsSubmittingRequest] =
        React.useState(false);

    const [preferredDate, setPreferredDate] = React.useState<Date | undefined>(
        undefined,
    );

    const handleChange = (
        event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
    ) => {
        const { name, value } = event.target;
        setForm((prev) => ({
            ...prev,
            [name]: value,
        }));
    };

    const handleCheckboxChange = (
        event: React.ChangeEvent<HTMLInputElement>,
    ) => {
        const { name, checked } = event.target;
        setForm((prev) => ({
            ...prev,
            [name]: checked,
        }));
    };

    const mentalHealthFields: (keyof IntakeFormState)[] = [
        "mh_little_interest",
        "mh_feeling_down",
        "mh_sleep",
        "mh_energy",
        "mh_appetite",
        "mh_self_esteem",
        "mh_concentration",
        "mh_motor",
        "mh_self_harm",
    ];

    // Submit Steps 1–3 only (assessment)
    const handleSubmitAssessment = async (
        event: React.FormEvent<HTMLFormElement>,
    ) => {
        event.preventDefault();

        if (!form.consent) {
            toast.error(
                "Please read and accept the consent statement before submitting.",
            );
            return;
        }

        if (!form.student_name.trim()) {
            toast.error("Please enter your name.");
            return;
        }

        if (!form.age.trim()) {
            toast.error("Please enter your age.");
            return;
        }

        if (!form.gender) {
            toast.error("Please select your gender.");
            return;
        }

        if (!form.living_situation) {
            toast.error("Please select your living situation.");
            return;
        }

        const missingMental = mentalHealthFields.filter(
            (key) => !(form as any)[key],
        );
        if (missingMental.length > 0) {
            toast.error(
                "Please answer all questions in the General Mental Health Status section.",
            );
            return;
        }

        setIsSubmittingAssessment(true);

        try {
            const assessmentPayload = {
                consent: form.consent,
                student_name: form.student_name.trim() || undefined,
                age: form.age ? Number(form.age) : undefined,
                gender: form.gender || undefined,
                occupation: form.occupation.trim() || undefined,
                living_situation: form.living_situation || undefined,
                living_situation_other:
                    form.living_situation === "other"
                        ? form.living_situation_other.trim() || undefined
                        : undefined,
                mh_little_interest: form.mh_little_interest || undefined,
                mh_feeling_down: form.mh_feeling_down || undefined,
                mh_sleep: form.mh_sleep || undefined,
                mh_energy: form.mh_energy || undefined,
                mh_appetite: form.mh_appetite || undefined,
                mh_self_esteem: form.mh_self_esteem || undefined,
                mh_concentration: form.mh_concentration || undefined,
                mh_motor: form.mh_motor || undefined,
                mh_self_harm: form.mh_self_harm || undefined,
            };

            const response = await submitIntakeAssessment(assessmentPayload);

            const successMessage =
                response?.message || "Your assessment has been submitted.";

            toast.success(successMessage);
            // We keep the answers on screen so the student can still see them.
        } catch (error) {
            const message =
                error instanceof Error
                    ? error.message
                    : "Failed to submit your assessment.";
            toast.error(message);
        } finally {
            setIsSubmittingAssessment(false);
        }
    };

    // Submit Step 4 only (counseling request)
    const handleSubmitRequest = async (
        event: React.FormEvent<HTMLFormElement>,
    ) => {
        event.preventDefault();

        if (!form.preferred_date) {
            toast.error("Please select your preferred date.");
            return;
        }

        if (!form.preferred_time) {
            toast.error("Please select your preferred time.");
            return;
        }

        if (!form.concern_type) {
            toast.error("Please select your main concern.");
            return;
        }

        if (!form.additional_details.trim()) {
            toast.error("Please enter a brief description of your concern.");
            return;
        }

        setIsSubmittingRequest(true);

        try {
            // For Step 4, only send the student's own description as details.
            const payloadDetails = form.additional_details.trim();

            const requestPayload = {
                concern_type: form.concern_type,
                urgency: form.urgency,
                preferred_date: form.preferred_date,
                preferred_time: form.preferred_time,
                details: payloadDetails,
            };

            const response = await submitIntakeRequest(requestPayload);

            const successMessage =
                response?.message || "Your counseling request has been submitted.";

            toast.success(successMessage);

            // Clear only Step 4 fields; keep Steps 1–3 in case the student reuses them.
            setForm((prev) => ({
                ...prev,
                concern_type: "",
                urgency: "medium",
                preferred_date: "",
                preferred_time: "",
                additional_details: "",
            }));
            setPreferredDate(undefined);
        } catch (error) {
            const message =
                error instanceof Error
                    ? error.message
                    : "Failed to submit your counseling request.";
            toast.error(message);
        } finally {
            setIsSubmittingRequest(false);
        }
    };

    return (
        <DashboardLayout
            title="Intake"
            description="Submit a counseling request and/or complete a short mental health needs assessment. You can review your submissions on the Evaluation page."
        >
            <div className="flex w-full justify-center">
                <div className="w-full max-w-3xl space-y-4">
                    {/* CARD 1: Steps 1–3 (Assessment) */}
                    <Card className="border-amber-100/80 bg-white/80 shadow-sm shadow-amber-100/60 backdrop-blur">
                        <CardHeader className="space-y-2 text-center">
                            <CardTitle className="text-base font-semibold text-amber-900">
                                Mental health needs assessment (Steps 1–3)
                            </CardTitle>
                            <p className="text-xs text-muted-foreground">
                                This assessment helps the Guidance &amp; Counseling Office
                                understand your overall well-being. You can submit this even
                                without sending a counseling request. A record of your
                                assessments will appear on the Evaluation page.
                            </p>
                        </CardHeader>

                        <CardContent>
                            <form className="space-y-6" onSubmit={handleSubmitAssessment}>
                                {/* STEP 1 – CONSENT */}
                                <section className="space-y-2 rounded-lg border border-amber-100 bg-amber-50/60 p-3 text-xs">
                                    <p className="font-semibold text-amber-900">
                                        Step 1 – Consent &amp; important notes
                                    </p>
                                    <p className="text-[0.7rem] text-muted-foreground">
                                        eCounseling is intended for guidance and counseling support.
                                        It is{" "}
                                        <span className="font-medium">
                                            not an emergency or crisis service
                                        </span>
                                        . For immediate safety concerns, please contact local
                                        emergency services or campus security right away.
                                    </p>
                                    <label className="mt-1 flex items-start gap-2 text-[0.7rem]">
                                        <input
                                            type="checkbox"
                                            name="consent"
                                            checked={form.consent}
                                            onChange={handleCheckboxChange}
                                            className="mt-[3px] h-4 w-4 rounded border-amber-300"
                                        />
                                        <span>
                                            I understand the purpose of this form and consent to
                                            sharing this information with the JRMSU Guidance &amp;
                                            Counseling Office for support and follow-up.
                                        </span>
                                    </label>
                                </section>

                                {/* STEP 2 – DEMOGRAPHIC INFORMATION */}
                                <section className="space-y-3">
                                    <p className="text-xs font-semibold text-amber-900">
                                        Step 2 – Demographic information
                                    </p>

                                    <div className="grid gap-3 sm:grid-cols-2">
                                        <div className="space-y-1.5">
                                            <Label
                                                htmlFor="student_name"
                                                className="text-xs font-medium text-amber-900"
                                            >
                                                Name
                                            </Label>
                                            <input
                                                id="student_name"
                                                name="student_name"
                                                value={form.student_name}
                                                onChange={handleChange}
                                                required
                                                placeholder="Juan Dela Cruz"
                                                className="h-9 w-full rounded-md border border-amber-100 bg-white/90 px-3 text-sm shadow-inner shadow-amber-50/70 outline-none ring-0 transition focus-visible:border-amber-300 focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-1 focus-visible:ring-offset-amber-50"
                                            />
                                        </div>

                                        <div className="space-y-1.5">
                                            <Label
                                                htmlFor="age"
                                                className="text-xs font-medium text-amber-900"
                                            >
                                                Age
                                            </Label>
                                            <input
                                                id="age"
                                                name="age"
                                                type="number"
                                                min={10}
                                                max={120}
                                                value={form.age}
                                                onChange={handleChange}
                                                required
                                                className="h-9 w-full rounded-md border border-amber-100 bg-white/90 px-3 text-sm shadow-inner shadow-amber-50/70 outline-none ring-0 transition focus-visible:border-amber-300 focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-1 focus-visible:ring-offset-amber-50"
                                            />
                                        </div>
                                    </div>

                                    <div className="grid gap-3 sm:grid-cols-2">
                                        <div className="space-y-1.5">
                                            <Label className="text-xs font-medium text-amber-900">
                                                Gender
                                            </Label>
                                            <div className="flex flex-col gap-1 text-[0.8rem] text-muted-foreground">
                                                <label className="inline-flex items-center gap-2">
                                                    <input
                                                        type="radio"
                                                        name="gender"
                                                        value="male"
                                                        checked={form.gender === "male"}
                                                        onChange={handleChange}
                                                        className="h-3.5 w-3.5 border-amber-300"
                                                    />
                                                    <span>Male</span>
                                                </label>
                                                <label className="inline-flex items-center gap-2">
                                                    <input
                                                        type="radio"
                                                        name="gender"
                                                        value="female"
                                                        checked={form.gender === "female"}
                                                        onChange={handleChange}
                                                        className="h-3.5 w-3.5 border-amber-300"
                                                    />
                                                    <span>Female</span>
                                                </label>
                                                <label className="inline-flex items-center gap-2">
                                                    <input
                                                        type="radio"
                                                        name="gender"
                                                        value="non_binary_other"
                                                        checked={form.gender === "non_binary_other"}
                                                        onChange={handleChange}
                                                        className="h-3.5 w-3.5 border-amber-300"
                                                    />
                                                    <span>Non-binary / Other</span>
                                                </label>
                                            </div>
                                        </div>

                                        <div className="space-y-1.5">
                                            <Label
                                                htmlFor="occupation"
                                                className="text-xs font-medium text-amber-900"
                                            >
                                                Occupation
                                            </Label>
                                            <input
                                                id="occupation"
                                                name="occupation"
                                                value={form.occupation}
                                                onChange={handleChange}
                                                placeholder="Student, working student, etc."
                                                className="h-9 w-full rounded-md border border-amber-100 bg-white/90 px-3 text-sm shadow-inner shadow-amber-50/70 outline-none ring-0 transition focus-visible:border-amber-300 focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-1 focus-visible:ring-offset-amber-50"
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-1.5">
                                        <Label className="text-xs font-medium text-amber-900">
                                            Living situation
                                        </Label>
                                        <div className="flex flex-col gap-1 text-[0.8rem] text-muted-foreground">
                                            <label className="inline-flex items-center gap-2">
                                                <input
                                                    type="radio"
                                                    name="living_situation"
                                                    value="alone"
                                                    checked={form.living_situation === "alone"}
                                                    onChange={handleChange}
                                                    className="h-3.5 w-3.5 border-amber-300"
                                                />
                                                <span>Alone</span>
                                            </label>
                                            <label className="inline-flex items-center gap-2">
                                                <input
                                                    type="radio"
                                                    name="living_situation"
                                                    value="with_family"
                                                    checked={form.living_situation === "with_family"}
                                                    onChange={handleChange}
                                                    className="h-3.5 w-3.5 border-amber-300"
                                                />
                                                <span>With family</span>
                                            </label>
                                            <label className="inline-flex items-center gap-2">
                                                <input
                                                    type="radio"
                                                    name="living_situation"
                                                    value="with_friends"
                                                    checked={form.living_situation === "with_friends"}
                                                    onChange={handleChange}
                                                    className="h-3.5 w-3.5 border-amber-300"
                                                />
                                                <span>With friends</span>
                                            </label>
                                            <label className="inline-flex items-center gap-2">
                                                <input
                                                    type="radio"
                                                    name="living_situation"
                                                    value="other"
                                                    checked={form.living_situation === "other"}
                                                    onChange={handleChange}
                                                    className="h-3.5 w-3.5 border-amber-300"
                                                />
                                                <span className="flex-1">
                                                    Other (please specify):
                                                    <input
                                                        type="text"
                                                        name="living_situation_other"
                                                        value={form.living_situation_other}
                                                        onChange={handleChange}
                                                        className="ml-2 h-7 flex-1 rounded-md border border-amber-100 bg-white/90 px-2 text-[0.75rem] shadow-inner shadow-amber-50/70 outline-none ring-0 transition focus-visible:border-amber-300 focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-1 focus-visible:ring-offset-amber-50"
                                                    />
                                                </span>
                                            </label>
                                        </div>
                                    </div>
                                </section>

                                {/* STEP 3 – GENERAL MENTAL HEALTH STATUS */}
                                <section className="space-y-3">
                                    <div className="space-y-1">
                                        <p className="text-xs font-semibold text-amber-900">
                                            Step 3 – General Mental Health Status
                                        </p>
                                        <p className="text-[0.7rem] text-muted-foreground">
                                            Over the past two weeks, how often have you been bothered by
                                            the following problems? Select one option for each
                                            statement.
                                        </p>
                                    </div>

                                    {/* Frequency legend (columns) */}
                                    <div className="grid grid-cols-[minmax(0,1.4fr)_repeat(4,minmax(0,1fr))] items-center gap-2 rounded-md bg-amber-50/80 px-3 py-2 text-[0.65rem] font-medium text-amber-900">
                                        <div>Question</div>
                                        <div className="text-center">Not at all</div>
                                        <div className="text-center">Several days</div>
                                        <div className="text-center">More than half the days</div>
                                        <div className="text-center">Nearly every day</div>
                                    </div>

                                    {/* Each question mirrors the paper form */}
                                    <div className="space-y-2 text-[0.7rem] text-muted-foreground">
                                        {/* 1 */}
                                        <div className="grid grid-cols-[minmax(0,1.4fr)_repeat(4,minmax(0,1fr))] items-center gap-2 rounded-md border border-amber-50 px-3 py-2">
                                            <div className="pr-2">
                                                Little interest or pleasure in doing things
                                            </div>
                                            {(
                                                [
                                                    "not_at_all",
                                                    "several_days",
                                                    "more_than_half",
                                                    "nearly_every_day",
                                                ] as MentalFrequency[]
                                            ).map((value) => (
                                                <div key={value} className="flex justify-center">
                                                    <input
                                                        type="radio"
                                                        name="mh_little_interest"
                                                        value={value}
                                                        checked={form.mh_little_interest === value}
                                                        onChange={handleChange}
                                                        className="h-3.5 w-3.5 border-amber-300"
                                                    />
                                                </div>
                                            ))}
                                        </div>

                                        {/* 2 */}
                                        <div className="grid grid-cols-[minmax(0,1.4fr)_repeat(4,minmax(0,1fr))] items-center gap-2 rounded-md border border-amber-50 px-3 py-2">
                                            <div className="pr-2">
                                                Feeling down, depressed, or hopeless
                                            </div>
                                            {(
                                                [
                                                    "not_at_all",
                                                    "several_days",
                                                    "more_than_half",
                                                    "nearly_every_day",
                                                ] as MentalFrequency[]
                                            ).map((value) => (
                                                <div key={value} className="flex justify-center">
                                                    <input
                                                        type="radio"
                                                        name="mh_feeling_down"
                                                        value={value}
                                                        checked={form.mh_feeling_down === value}
                                                        onChange={handleChange}
                                                        className="h-3.5 w-3.5 border-amber-300"
                                                    />
                                                </div>
                                            ))}
                                        </div>

                                        {/* 3 */}
                                        <div className="grid grid-cols-[minmax(0,1.4fr)_repeat(4,minmax(0,1fr))] items-center gap-2 rounded-md border border-amber-50 px-3 py-2">
                                            <div className="pr-2">
                                                Trouble falling or staying asleep, or sleeping too much
                                            </div>
                                            {(
                                                [
                                                    "not_at_all",
                                                    "several_days",
                                                    "more_than_half",
                                                    "nearly_every_day",
                                                ] as MentalFrequency[]
                                            ).map((value) => (
                                                <div key={value} className="flex justify-center">
                                                    <input
                                                        type="radio"
                                                        name="mh_sleep"
                                                        value={value}
                                                        checked={form.mh_sleep === value}
                                                        onChange={handleChange}
                                                        className="h-3.5 w-3.5 border-amber-300"
                                                    />
                                                </div>
                                            ))}
                                        </div>

                                        {/* 4 */}
                                        <div className="grid grid-cols-[minmax(0,1.4fr)_repeat(4,minmax(0,1fr))] items-center gap-2 rounded-md border border-amber-50 px-3 py-2">
                                            <div className="pr-2">
                                                Feeling tired or having little energy
                                            </div>
                                            {(
                                                [
                                                    "not_at_all",
                                                    "several_days",
                                                    "more_than_half",
                                                    "nearly_every_day",
                                                ] as MentalFrequency[]
                                            ).map((value) => (
                                                <div key={value} className="flex justify-center">
                                                    <input
                                                        type="radio"
                                                        name="mh_energy"
                                                        value={value}
                                                        checked={form.mh_energy === value}
                                                        onChange={handleChange}
                                                        className="h-3.5 w-3.5 border-amber-300"
                                                    />
                                                </div>
                                            ))}
                                        </div>

                                        {/* 5 */}
                                        <div className="grid grid-cols-[minmax(0,1.4fr)_repeat(4,minmax(0,1fr))] items-center gap-2 rounded-md border border-amber-50 px-3 py-2">
                                            <div className="pr-2">Poor appetite or overeating</div>
                                            {(
                                                [
                                                    "not_at_all",
                                                    "several_days",
                                                    "more_than_half",
                                                    "nearly_every_day",
                                                ] as MentalFrequency[]
                                            ).map((value) => (
                                                <div key={value} className="flex justify-center">
                                                    <input
                                                        type="radio"
                                                        name="mh_appetite"
                                                        value={value}
                                                        checked={form.mh_appetite === value}
                                                        onChange={handleChange}
                                                        className="h-3.5 w-3.5 border-amber-300"
                                                    />
                                                </div>
                                            ))}
                                        </div>

                                        {/* 6 */}
                                        <div className="grid grid-cols-[minmax(0,1.4fr)_repeat(4,minmax(0,1fr))] items-center gap-2 rounded-md border border-amber-50 px-3 py-2">
                                            <div className="pr-2">
                                                Feeling bad about yourself—or that you are a failure or
                                                have let yourself or your family down
                                            </div>
                                            {(
                                                [
                                                    "not_at_all",
                                                    "several_days",
                                                    "more_than_half",
                                                    "nearly_every_day",
                                                ] as MentalFrequency[]
                                            ).map((value) => (
                                                <div key={value} className="flex justify-center">
                                                    <input
                                                        type="radio"
                                                        name="mh_self_esteem"
                                                        value={value}
                                                        checked={form.mh_self_esteem === value}
                                                        onChange={handleChange}
                                                        className="h-3.5 w-3.5 border-amber-300"
                                                    />
                                                </div>
                                            ))}
                                        </div>

                                        {/* 7 */}
                                        <div className="grid grid-cols-[minmax(0,1.4fr)_repeat(4,minmax(0,1fr))] items-center gap-2 rounded-md border border-amber-50 px-3 py-2">
                                            <div className="pr-2">
                                                Trouble concentrating on things, such as reading the
                                                newspaper or watching television
                                            </div>
                                            {(
                                                [
                                                    "not_at_all",
                                                    "several_days",
                                                    "more_than_half",
                                                    "nearly_every_day",
                                                ] as MentalFrequency[]
                                            ).map((value) => (
                                                <div key={value} className="flex justify-center">
                                                    <input
                                                        type="radio"
                                                        name="mh_concentration"
                                                        value={value}
                                                        checked={form.mh_concentration === value}
                                                        onChange={handleChange}
                                                        className="h-3.5 w-3.5 border-amber-300"
                                                    />
                                                </div>
                                            ))}
                                        </div>

                                        {/* 8 */}
                                        <div className="grid grid-cols-[minmax(0,1.4fr)_repeat(4,minmax(0,1fr))] items-center gap-2 rounded-md border border-amber-50 px-3 py-2">
                                            <div className="pr-2">
                                                Moving or speaking so slowly that other people could have
                                                noticed? Or the opposite—being so fidgety or restless that
                                                you have been moving around a lot more than usual
                                            </div>
                                            {(
                                                [
                                                    "not_at_all",
                                                    "several_days",
                                                    "more_than_half",
                                                    "nearly_every_day",
                                                ] as MentalFrequency[]
                                            ).map((value) => (
                                                <div key={value} className="flex justify-center">
                                                    <input
                                                        type="radio"
                                                        name="mh_motor"
                                                        value={value}
                                                        checked={form.mh_motor === value}
                                                        onChange={handleChange}
                                                        className="h-3.5 w-3.5 border-amber-300"
                                                    />
                                                </div>
                                            ))}
                                        </div>

                                        {/* 9 */}
                                        <div className="grid grid-cols-[minmax(0,1.4fr)_repeat(4,minmax(0,1fr))] items-center gap-2 rounded-md border border-amber-50 px-3 py-2">
                                            <div className="pr-2 font-medium text-amber-900">
                                                Thoughts that you would be better off dead or of hurting
                                                yourself in some way
                                            </div>
                                            {(
                                                [
                                                    "not_at_all",
                                                    "several_days",
                                                    "more_than_half",
                                                    "nearly_every_day",
                                                ] as MentalFrequency[]
                                            ).map((value) => (
                                                <div key={value} className="flex justify-center">
                                                    <input
                                                        type="radio"
                                                        name="mh_self_harm"
                                                        value={value}
                                                        checked={form.mh_self_harm === value}
                                                        onChange={handleChange}
                                                        className="h-3.5 w-3.5 border-amber-300"
                                                    />
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </section>

                                <div className="flex flex-col gap-2 pt-2 sm:flex-row sm:items-center sm:justify-between">
                                    <Button
                                        type="submit"
                                        className="w-full sm:w-auto"
                                        disabled={isSubmittingAssessment}
                                    >
                                        {isSubmittingAssessment ? "Submitting..." : "Submit assessment"}
                                    </Button>

                                    <p className="text-[0.7rem] text-muted-foreground sm:text-right">
                                        This assessment can be submitted on its own and is stored
                                        securely by the Guidance &amp; Counseling Office. You can
                                        see your assessment history on the Evaluation page.
                                    </p>
                                </div>
                            </form>
                        </CardContent>
                    </Card>

                    {/* CARD 2: Step 4 (Counseling Request) */}
                    <Card className="border-amber-100/80 bg-white/80 shadow-sm shadow-amber-100/60 backdrop-blur">
                        <CardHeader className="space-y-2 text-center">
                            <CardTitle className="text-base font-semibold text-amber-900">
                                Counseling intake – main concern &amp; preferred schedule (Step 4)
                            </CardTitle>
                            <p className="text-xs text-muted-foreground">
                                Use this form to request a counseling appointment. You can send a
                                request with or without completing the assessment above. You can
                                track the status of your requests on the Evaluation page.
                            </p>
                        </CardHeader>

                        <CardContent>
                            <form className="space-y-4" onSubmit={handleSubmitRequest}>
                                {/* STEP 4 – SCHEDULING & MAIN CONCERN */}
                                <section className="space-y-4">
                                    <p className="text-xs font-semibold text-amber-900">
                                        Step 4 – Main concern & preferred schedule
                                    </p>

                                    {/* Concern type */}
                                    <div className="space-y-1.5">
                                        <Label
                                            id="concern_type_label"
                                            className="text-xs font-medium text-amber-900"
                                        >
                                            Main concern
                                        </Label>
                                        <Select
                                            value={form.concern_type}
                                            onValueChange={(value) =>
                                                setForm((prev) => ({
                                                    ...prev,
                                                    concern_type: value,
                                                }))
                                            }
                                        >
                                            <SelectTrigger
                                                aria-labelledby="concern_type_label"
                                                className="h-9 w-full text-left"
                                            >
                                                <SelectValue placeholder="Select a concern..." />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="academic">Academic</SelectItem>
                                                <SelectItem value="personal">
                                                    Personal / emotional
                                                </SelectItem>
                                                <SelectItem value="family">Family</SelectItem>
                                                <SelectItem value="mental_health">
                                                    Mental health
                                                </SelectItem>
                                                <SelectItem value="career">Career / future</SelectItem>
                                                <SelectItem value="other">Other</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    {/* Urgency */}
                                    <div className="space-y-1.5">
                                        <Label
                                            id="urgency_label"
                                            className="text-xs font-medium text-amber-900"
                                        >
                                            How urgent is this?
                                        </Label>
                                        <Select
                                            value={form.urgency}
                                            onValueChange={(value) =>
                                                setForm((prev) => ({
                                                    ...prev,
                                                    urgency: value as IntakeFormState["urgency"],
                                                }))
                                            }
                                        >
                                            <SelectTrigger
                                                aria-labelledby="urgency_label"
                                                className="h-9 w-full text-left"
                                            >
                                                <SelectValue placeholder="Select urgency" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="low">Not urgent</SelectItem>
                                                <SelectItem value="medium">
                                                    Soon (within 1–2 weeks)
                                                </SelectItem>
                                                <SelectItem value="high">
                                                    Urgent (as soon as possible)
                                                </SelectItem>
                                            </SelectContent>
                                        </Select>
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
                                                        className={`w-full justify-start text-left font-normal ${
                                                            !preferredDate
                                                                ? "text-muted-foreground"
                                                                : ""
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

                                    {/* Additional description */}
                                    <div className="space-y-1.5">
                                        <Label
                                            htmlFor="additional_details"
                                            className="text-xs font-medium text-amber-900"
                                        >
                                            Brief description of your concern
                                        </Label>
                                        <textarea
                                            id="additional_details"
                                            name="additional_details"
                                            required
                                            rows={5}
                                            value={form.additional_details}
                                            onChange={handleChange}
                                            placeholder="Share what you’re going through, how long it has been happening, and anything else you want your counselor to know."
                                            className="w-full rounded-md border border-amber-100 bg-white/90 px-3 py-2 text-sm shadow-inner shadow-amber-50/70 outline-none ring-0 transition focus-visible:border-amber-300 focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-1 focus-visible:ring-offset-amber-50"
                                        />
                                        <p className="text-[0.7rem] text-muted-foreground">
                                            You can use English, Filipino, or Bisaya — whatever you’re
                                            most comfortable with.
                                        </p>
                                    </div>
                                </section>

                                <div className="flex flex-col gap-2 pt-2 sm:flex-row sm:items-center sm:justify-between">
                                    <Button
                                        type="submit"
                                        className="w-full sm:w-auto"
                                        disabled={isSubmittingRequest}
                                    >
                                        {isSubmittingRequest
                                            ? "Submitting..."
                                            : "Submit counseling request"}
                                    </Button>

                                    <p className="text-[0.7rem] text-muted-foreground sm:text-right">
                                        Your request will be linked to your JRMSU account and kept
                                        private within the Guidance &amp; Counseling Office. You
                                        can track your requests and sessions on the Evaluation page.
                                    </p>
                                </div>
                            </form>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </DashboardLayout>
    );
};

export default StudentIntake;
